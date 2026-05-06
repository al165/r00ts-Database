import express from 'express';
import session from 'express-session';
import csv from 'csv-parser';
import { isIP, isIPv6 } from 'net';
import { Readable } from 'stream'

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

import Fuse from 'fuse.js';

import multer from 'multer';
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    fileFilter: (_req, file, cb) => {
        if (file.mimetype == 'text/csv' || file.originalname.endsWith('.csv'))
            cb(null, true);
        else
            cb(new Error('Only CSV files allowed'));
    }
});

import { config } from 'dotenv';

import { IPtoInt, isIpReserved } from './ip_utils.js';
import { COUNTRY_CODE_TO_NAME } from './country_codes.js';

const CONFIG_FILE = process.argv[2] || '.env';
console.log("Loading config file: " + CONFIG_FILE);

config({ path: CONFIG_FILE });

const app = express();

let DATABASE_FILE = process.env.DATABASE_FILE || 'data.db';
if (DATABASE_FILE[0] !== '/') {
    DATABASE_FILE = path.join(__dirname, DATABASE_FILE);
}
console.log(`DATABASE_FILE: ${DATABASE_FILE}`);

let dbPromise = open({
    filename: DATABASE_FILE,
    driver: sqlite3.Database
});

let user_version;

const PORT = process.env.PORT || 3000;
console.log(`PORT: ${PORT}`);

let ROOT = process.env.ROOT || '';
if (ROOT.at(-1) === '/')
    ROOT = ROOT.slice(0, -1);

console.log(`ROOT: ${ROOT}`);

// networksdb API key
const NETWORKSDB_API = process.env.NETWORKSDB_API || '';
if (!NETWORKSDB_API)
    console.warn("NETWORKSDB_API not set! Cannot fetch new ip block info.");
else
    console.log("NETWORKSDB_API found");


// Setup continent <-> country map
const CONTINENT_COUNTRY_LIST = {};

await new Promise((resolve, reject) => {
    fs.createReadStream('tools/countries.csv')
        .pipe(csv())
        .on('data', (row) => {
            if (CONTINENT_COUNTRY_LIST[row.Continent])
                CONTINENT_COUNTRY_LIST[row.Continent].push(row.Code);
            else
                CONTINENT_COUNTRY_LIST[row.Continent] = [row.Code];
        })
        .on('end', () => {
            console.log('Finished creating country/continent list');
            resolve();
        })
        .on('error', reject);
});


// Middleware setup
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(express.json());

// Session configuration
app.use(session({
    secret: 'secretkey',
    resave: false,
    saveUninitialized: false
}));

// Logging all requests
app.use((req, _res, next) => {
    console.log(`[${req.method}] ${req.url}`);
    next();
});

const USER = {
    username: process.env.USERNAME,
    password: process.env.PASSWORD
};

// Authentication Middleware
function isAuthenticated(req, res, next) {
    if (checkAuthenticated(req))
        return next();
    res.redirect(path.join(ROOT, '/login'));
}

function checkAuthenticated(req) {
    return (req.session.user && req.session.user.password === USER.password)
}

// Routes
app.get('/login', (_req, res) => {
    res.render('login', { root: ROOT });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === USER.username && password === USER.password) {
        req.session.user = USER;
        res.redirect(path.join(ROOT, '/dashboard'));
    } else {
        res.render('login', { error: 'Invalid credentials', root: ROOT });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect(path.join(ROOT, '/'));
});

app.get('/dashboard', isAuthenticated, async (_req, res) => {
    return res.render('dashboard', { root: ROOT, user_version });
});

app.get('/network', async (req, res) => {
    const { id } = req.query;

    const db = await dbPromise;
    const network = await db.get("SELECT * FROM Networks WHERE id = ?", [id]);
    console.log(network);

    const datacenters = db.all("SELECT * FROM Datacenters JOIN NetworksDatacenters ON Datacenters.id = NetworksDatacenters.datacenterId WHERE NetworksDatacenters.networkId = ?", [id]);

    return res.render('network', { root: ROOT, user_version, network, datacenters });
});

// app.get('/datacenter', async (req, res) => {
//     const { id } = req.query;
//
//     const db = await dbPromise;
//     const datacenter = await db.get("SELECT * FROM Datacenters WHERE id = ?", [id]);
//
//     return res.render('datacenter', { root: ROOT, user_version, datacenter });
// });

app.get('/', async (_req, res) => {
    return res.render('home', { root: ROOT, user_version });
});


// API Endpoints

const relations = [
    {
        name: "companies",
        table: "ArticlesCompanies",
        joinTable: "Companies",
        joinKey: "companyId"
    },
    {
        name: "impacts",
        table: "ArticlesImpacts",
        joinTable: "Impacts",
        joinKey: "impactId"
    },
    {
        name: "communities",
        table: "ArticlesCommunities",
        joinTable: "Communities",
        joinKey: "communityId"
    }
];

const relationSql = relations.map(r => `
    (
        SELECT COALESCE(
            json_group_array(
                json_object('id', j.id, 'name', j.name)
            ),
            json('[]')
        )
        FROM ${r.table} x
        JOIN ${r.joinTable} j ON j.id = x.${r.joinKey}
        WHERE x.articleId = a.id
    ) AS ${r.name}
`).join(",\n");

app.get('/search', async (req, res) => {
    // Fuzzy string search

    const { q } = req.query;
    console.log(q);

    if (!q || q.trim().length < 2)
        return res.status(400).json({ error: 'Query must be at least 2 characters' });

    const sql = `
        SELECT a.id, a.title, a.url, GROUP_CONCAT(c.name, ', ') AS companies 
        FROM Articles a
        LEFT JOIN ArticlesCompanies ac ON a.id = ac.articleId
        LEFT JOIN Companies c ON ac.companyId = c.id
        GROUP BY a.id
    `;

    const db = await dbPromise;
    const rows = await db.all(sql, []);

    const results = fuzzySearch(rows, q, ['title', 'companies']);
    return res.json({ results });
});

app.get('/api/search', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    let { approved, type, source, perspective, continent, country, region, companies, impacts, communities } = req.query;

    // console.log(req.query);

    if (approved) approved = parseInt(approved);
    if (source) source = parseInt(source);
    if (perspective) perspective = parseInt(perspective);

    if (continent) continent = parseInt(continent);
    if (country) country = parseInt(country);
    if (region) region = parseInt(region);

    if (companies) {
        if (!Array.isArray(companies))
            companies = [parseInt(companies)]
        else
            companies = companies.map(el => parseInt(el));
    }

    if (impacts) {
        if (!Array.isArray(impacts))
            impacts = [parseInt(impacts)]
        else
            impacts = impacts.map(el => parseInt(el));
    }

    if (communities) {
        if (!Array.isArray(communities))
            communities = [parseInt(communities)]
        else
            communities = communities.map(el => parseInt(el));
    }

    let whereClauses = [];
    let whereArgs = [];

    if (!checkAuthenticated(req)) {
        whereClauses.push('a.approved = 1');
    } else if (approved != undefined) {
        whereClauses.push('a.approved = ?');
        whereArgs.push(approved);
    }

    function addItem(name, values, xrefTable) {
        if (values == undefined) return;

        if (!Array.isArray(values)) {
            whereClauses.push(`a.${name} = ?`)
            whereArgs.push(values);
            return
        }

        const paramString = values.map(_ => '?').join(', ');
        whereClauses.push(`EXISTS (SELECT 1 FROM ${xrefTable} x WHERE x.articleId = a.id AND x.${name} in (${paramString}))`);
        whereArgs.push(...values);
    }

    addItem('source', source);
    addItem('type', type);
    addItem('perspective', perspective);
    addItem('continent', continent);
    addItem('country', country);
    addItem('region', region);

    addItem('companyId', companies, 'ArticlesCompanies');
    addItem('impactId', impacts, 'ArticlesImpacts');
    addItem('communityId', communities, 'ArticlesCommunities');

    let whereClause = '';
    if (whereClauses.length) {
        whereClause = `WHERE ${whereClauses.join(' AND\n')}`;
    }

    const sql = `
        SELECT
        a.id,
        a.title,
        a.url,
        a.type,
        a.source,
        a.date,
        a.perspective,
        a.location,
        a.continent,
        a.country,
        a.region,
        a.city,
        a.addedBy,
        a.addDate,
        a.notes,
        a.approved,
        ${relationSql}
        FROM Articles a
        ${whereClause}
        LIMIT ?
        OFFSET ?
    `;

    // console.log(sql);

    const db = await dbPromise;
    const rows = await db.all(
        sql,
        [...whereArgs, limit, offset]
    );

    const articles = rows.map(row => ({
        ...row,
        companies: JSON.parse(row.companies),
        impacts: JSON.parse(row.impacts),
        communities: JSON.parse(row.communities),
    }));

    return res.json({ articles, page, limit });
});

app.get('/api/sources', async (_req, res) => {
    const db = await dbPromise;
    const sources = await db.all("SELECT * FROM Sources");

    return res.json(sources);
});

app.get('/api/impacts', async (_req, res) => {
    const db = await dbPromise;
    const impacts = await db.all("SELECT * FROM Impacts");

    return res.json(impacts);
});

app.get('/api/communities', async (_req, res) => {
    const db = await dbPromise;
    const communities = await db.all("SELECT * FROM Communities");

    return res.json(communities);
});

app.get('/api/companies', async (_req, res) => {
    const db = await dbPromise;
    const companies = await db.all("SELECT * FROM Companies");

    return res.json(companies);
});

app.get('/api/perspectives', async (_req, res) => {
    const db = await dbPromise;
    const perspectives = await db.all("SELECT * FROM Perspectives");

    return res.json(perspectives);
});

app.post('/api/article', upload.none(), async (req, res) => {

    console.log(req.body);

    let { title, url, date, source, type, perspective, companies, impacts, communities, continent, country, region, city, notes, approved } = req.body;

    if (source) source = parseInt(source);
    if (continent) continent = parseInt(continent);
    if (country) country = parseInt(country);
    if (region) region = parseInt(region);
    if (city) city = parseInt(city);
    approved = approved ? 1 : 0;

    if (notes == undefined) notes = "";
    console.log(notes);
    if (perspective) perspective = parseInt(perspective);

    if (!title || !url || source == undefined)
        return res.sendStatus(400);

    const db = await dbPromise;
    url = fixUrl(url);

    // Add article
    const addedBy = "API";
    const nowDate = new Date();
    let year = new Intl.DateTimeFormat('en', { year: 'numeric' }).format(nowDate);
    let month = new Intl.DateTimeFormat('en', { month: '2-digit' }).format(nowDate);
    let day = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(nowDate);
    const addDate = `${day}/${month}/${year}`;

    let location = "";
    if (continent != undefined && continent >= 0) {
        const row = await db.get("SELECT * FROM Places WHERE id = ?", [continent]);
        if (row && row.name)
            location += row.name;
    }

    if (country != undefined && country >= 0) {
        const row = await db.get("SELECT * FROM Places WHERE id = ?", [country]);
        if (row && row.name)
            location += '/' + row.name;
    }

    if (region != undefined && region >= 0) {
        const row = await db.get("SELECT * FROM Places WHERE id = ?", [region]);
        if (row && row.name)
            location += '/' + row.name;
    }

    if (city != undefined && city >= 0) {
        const row = await db.get("SELECT * FROM Places WHERE id = ?", [city]);
        if (row && row.name)
            location += '/' + row.name;
    }


    let articleId;
    await db.run(
        "INSERT INTO Articles(title, url, type, source, date, perspective, continent, country, region, city, location, notes, approved, addedBy, addDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [title, url, type, source, date, perspective, continent, country, region, city, location, notes, approved, addedBy, addDate],
        (error) => {
            next(error);
        }).then(result => {
            articleId = result.lastID;
        });

    // Update XRef tables

    if (companies) {
        await db.run("BEGIN TRANSACTION");
        for (const companyId of companies) {
            await db.run("INSERT INTO ArticlesCompanies(articleId, companyId) VALUES (?, ?)", [articleId, companyId]);
        }
        await db.run("COMMIT");
    }

    if (impacts) {
        await db.run("BEGIN TRANSACTION");
        for (const impactId of impacts) {
            await db.run("INSERT INTO ArticlesImpacts(articleId, impactId) VALUES (?, ?)", [articleId, impactId]);
        }
        await db.run("COMMIT");
    }

    if (communities) {
        await db.run("BEGIN TRANSACTION");
        for (const communityId of communities) {
            await db.run("INSERT INTO ArticlesCommunities(articleId, communityId) VALUES (?, ?)", [articleId, communityId]);
        }
        await db.run("COMMIT");
    }

    updateVersion(db);

    const statement = `
    SELECT
        a.id,
        a.title,
        a.url,
        a.type,
        a.source,
        a.date,
        a.perspective,
        a.location,
        a.continent,
        a.country,
        a.region,
        a.city,
        a.notes,
        a.addedBy,
        a.addDate,
        a.approved,
        ${relationSql}
        FROM Articles a
        WHERE id = ?
    `;
    const newRowData = await db.get(statement, [articleId]);
    const newRow = {
        ...newRowData,
        companies: JSON.parse(newRowData.companies),
        impacts: JSON.parse(newRowData.impacts),
        communities: JSON.parse(newRowData.communities),
    };

    return res.status(201).json(newRow);
});

app.delete('/api/article', isAuthenticated, async (req, res, next) => {
    const { id } = req.query;
    console.log(id);

    const db = await dbPromise;
    await db.run("DELETE FROM Articles WHERE id = ?", [id], (error) => next(error));

    // Update XRefs
    await db.run("DELETE FROM ArticlesCompanies WHERE articleId = ?", [id], (error) => next(error))
    await db.run("DELETE FROM ArticlesImpacts WHERE articleId = ?", [id], (error) => next(error))
    await db.run("DELETE FROM ArticlesCommunities WHERE articleId = ?", [id], (error) => next(error))

    updateVersion(db);

    return res.sendStatus(204);
});

app.put('/api/article', isAuthenticated, upload.none(), async (req, res, next) => {
    console.log(req.body);

    let { id, title, url, date, source, type, perspective, companies, impacts, communities, continent, country, region, city, notes, approved } = req.body;

    if (id == undefined)
        return res.sendStatus(400);

    if (source) source = parseInt(source);
    if (continent) continent = parseInt(continent);
    if (country) country = parseInt(country);
    if (region) region = parseInt(region);
    if (city) city = parseInt(city);
    approved = approved ? 1 : 0;
    if (perspective) perspective = parseInt(perspective);
    if (notes == undefined) notes = "";

    let sqlSet = [];
    let args = [];

    sqlSet.push('title = ?');
    args.push(title);

    sqlSet.push('url = ?');
    args.push(url);

    if (date) {
        sqlSet.push('date = ?');
        args.push(date);
    }

    sqlSet.push('source = ?');
    args.push(source);

    if (type) {
        sqlSet.push('type = ?');
        args.push(type);
    }

    const db = await dbPromise;

    let location = "";
    if (continent != undefined && continent >= 0) {
        const row = await db.get("SELECT * FROM Places WHERE id = ?", [continent]);
        if (row && row.name)
            location += row.name;
        sqlSet.push('continent = ?');
        args.push(continent);
    } else {
        sqlSet.push('continent = ?');
        args.push(undefined);
    }

    if (country != undefined && country >= 0) {
        const row = await db.get("SELECT * FROM Places WHERE id = ?", [country]);
        if (row && row.name)
            location += '/' + row.name;
        sqlSet.push('country = ?');
        args.push(country);
    } else {
        sqlSet.push('country = ?');
        args.push(undefined);
    }

    if (region != undefined && region >= 0) {
        const row = await db.get("SELECT * FROM Places WHERE id = ?", [region]);
        if (row && row.name)
            location += '/' + row.name;
        sqlSet.push('region = ?');
        args.push(region);
    } else {
        sqlSet.push('region = ?');
        args.push(undefined);
    }

    if (city != undefined && city >= 0) {
        const row = await db.get("SELECT * FROM Places WHERE id = ?", [city]);
        if (row && row.name)
            location += '/' + row.name;
        sqlSet.push('city = ?');
        args.push(city);
    } else {
        sqlSet.push('city = ?');
        args.push(undefined);
    }

    sqlSet.push('location = ?');
    args.push(location);

    sqlSet.push('perspective = ?');
    args.push(perspective);

    sqlSet.push('notes = ?');
    args.push(notes);

    sqlSet.push('approved = ?');
    args.push(approved);

    const sql = `UPDATE Articles SET ${sqlSet.join(', ')} WHERE id = ?`;
    args.push(id);

    await db.run(sql, args, (error) => { next(error) });

    // Update XRefs
    if (companies) {
        await db.run("DELETE FROM ArticlesCompanies WHERE articleId = ?", [id]);
        await db.run("BEGIN TRANSACTION");
        for (const companyId of companies) {
            await db.run("INSERT INTO ArticlesCompanies(articleId, companyId) VALUES (?, ?)", [id, companyId]);
        }
        await db.run("COMMIT");
    } else {
        await db.run("DELETE FROM ArticlesCompanies WHERE articleId = ?", [id]);
    }

    if (impacts) {
        await db.run("DELETE FROM ArticlesImpacts WHERE articleId = ?", [id]);
        await db.run("BEGIN TRANSACTION");
        for (const impactId of impacts) {
            await db.run("INSERT INTO ArticlesImpacts(articleId, impactId) VALUES (?, ?)", [id, impactId]);
        }
        await db.run("COMMIT");
    } else {
        await db.run("DELETE FROM ArticlesImpacts WHERE articleId = ?", [id]);
    }

    if (communities) {
        await db.run("DELETE FROM ArticlesCommunities WHERE articleId = ?", [id]);
        await db.run("BEGIN TRANSACTION");
        for (const communityId of communities) {
            await db.run("INSERT INTO ArticlesCommunities(articleId, communityId) VALUES (?, ?)", [id, communityId]);
        }
        await db.run("COMMIT");
    } else {
        await db.run("DELETE FROM ArticlesCommunities WHERE articleId = ?", [id]);
    }

    updateVersion(db);

    const statement = `
    SELECT
        a.id,
        a.title,
        a.url,
        a.type,
        a.source,
        a.date,
        a.perspective,
        a.location,
        a.continent,
        a.country,
        a.region,
        a.city,
        a.addedBy,
        a.addDate,
        a.notes,
        a.approved,
        ${relationSql}
        FROM Articles a
        WHERE id = ?
    `;
    const newRowData = await db.get(statement, [id]);
    const newRow = {
        ...newRowData,
        companies: JSON.parse(newRowData.companies),
        impacts: JSON.parse(newRowData.impacts),
        communities: JSON.parse(newRowData.communities),
    };

    return res.status(200).json(newRow);
});

app.post('/api/csv', isAuthenticated, upload.single('csvfile'), async (req, res, _next) => {
    if (!req.file)
        return res.status(400).json({ error: 'No CSV file' });

    const results = [];
    const bufferStream = Readable.from(req.file.buffer);
    bufferStream
        .pipe(csv())
        .on('data', (data) => {
            results.push(data);
        })
        .on('end', async () => {
            console.log("Finished parsing CSV:");
            // console.log(results);
            const messages = await batchUpload(results);
            res.status(200).json(messages);
        })
        .on('error', (error) => {
            console.error('Error parsing CSV: ' + error.message);
            res.status(500).json({ error: 'Error parsing CSV' });
        })
});

app.post('/api/source', async (req, res, next) => {
    console.log(req.body);

    const newSource = removeWhitespaceExceptSpace(req.body.newSource);
    if (newSource.length == 0)
        try {
            throw new Error('Invalid source name');
        } catch (error) {
            next(error);
        }

    let newSourceURL = req.body.newSourceURL;
    if (!newSourceURL || newSourceURL.length == 0)
        try {
            throw new Error('Invalid source URL');
        } catch (error) {
            next(error);
        }

    if (!/^https?:\/\//i.test(newSourceURL))
        newSourceURL = 'http://' + newSourceURL;

    const db = await dbPromise;
    let newSourceId;
    await db.run("INSERT INTO Sources(name, url) VALUES (?, ?)", [newSource, newSourceURL], (error) => {
        next(error);
    }).then(result => {
        newSourceId = result.lastID;
    });

    console.log(`Add source, newSourceId = ${newSourceId}`);

    const newSourceData = {
        name: newSource,
        url: newSourceURL,
        id: newSourceId
    };

    await updateVersion(db);

    return res.status(201).json(newSourceData);
});

app.post('/api/impacts', async (req, res) => {
    const newImpact = removeWhitespaceExceptSpace(req.body.name);
    if (newImpact.length == 0)
        try {
            throw new Error('Invalid impact name');
        } catch (error) {
            next(error);
        }

    let impactId;
    const db = await dbPromise;
    await db.run("INSERT INTO Impacts(name) VALUES (?)", [newImpact], (error) => {
        next(error);
    }).then(result => {
        impactId = result.lastID;
    });

    const newImpactData = {
        id: impactId,
        name: newImpact
    };

    await updateVersion(db);

    return res.json(newImpactData);
});

app.post('/api/communities', async (req, res) => {
    const newCommunity = removeWhitespaceExceptSpace(req.body.name);
    if (newCommunity.length == 0)
        try {
            throw new Error('Invalid company name');
        } catch (error) {
            next(error);
        }

    const db = await dbPromise;
    let newCommunityId;
    await db.run("INSERT INTO Communities(name) VALUES (?)", [newCommunity], (error) => {
        next(error);
    }).then(result => {
        newCommunityId = result.lastID;
    });

    const newCommunityData = {
        name: newCommunity,
        id: newCommunityId
    };

    await updateVersion(db);

    return res.status(201).json(newCommunityData);
});

app.post('/api/companies', async (req, res) => {
    const newCompany = removeWhitespaceExceptSpace(req.body.name);
    if (newCompany.length == 0)
        try {
            throw new Error('Invalid company name');
        } catch (error) {
            next(error);
        }

    const db = await dbPromise;
    let newCompanyId;
    await db.run("INSERT INTO Companies(name) VALUES (?)", [newCompany], (error) => {
        next(error);
    }).then(result => {
        newCompanyId = result.lastID;
    });

    const newCompanyData = {
        name: newCompany,
        id: newCompanyId
    };

    await updateVersion(db);

    return res.status(201).json(newCompanyData);
});

app.get('/api/places/continents', async (_req, res) => {
    const db = await dbPromise;
    const continents = await db.all("SELECT * FROM Places WHERE type = 'continent'");

    return res.json(continents);
});

app.get('/api/places', async (req, res) => {
    const { divisionType, divisionName, placeId } = req.query;

    if (!(divisionType && divisionName) && !placeId) {
        console.error("Bad request");
        return res.sendStatus(400);
    }

    const db = await dbPromise;

    if (placeId != undefined && placeId != "") {
        const placeRow = await db.get("SELECT * FROM Places WHERE id = ?", [placeId]);
        return res.json(placeRow);
    } else {
        const divisionId = await db.get("SELECT id FROM Places WHERE type = ? AND name = ?", [divisionType, divisionName]);
        if (divisionId === undefined || divisionId.id === undefined) {
            console.error("DivisionId not found");
            return res.sendStatus(404);
        }

        const places = await db.all("SELECT * FROM Places WHERE parent_id = ? ORDER BY name ASC", [divisionId.id]);
        return res.json(places);
    }
});

app.post('/api/ip', async (req, res) => {
    const { ip } = req.query;
    const { clues } = req.body;

    console.log(ip);

    if (!ip || isIP(ip) == 0)
        return res.sendStatus(400);

    if (isIPv6(ip)) {
        console.warn(`IPv6 not supported. ${ip}`)
        return res.sendStatus(400);
    }

    const ip_int = IPtoInt(ip);
    if (isIpReserved(ip_int)) {
        return res.json({ reserved: true });
    }

    const db = await dbPromise;
    let net = await db.get("SELECT * FROM Networks WHERE ? BETWEEN start_int AND end_int", [ip_int]);

    if (!net) {
        console.log(`No network found for IP ${ip}, fetching from networksdb.io...`)

        if (!NETWORKSDB_API) {
            console.warn("NETWORKSDB_API not set, cannot complete request");
            return res.sendStatus(500);
        }

        const params = new URLSearchParams({ ip });
        const r = await fetch(`https://networksdb.io/api/ip-info?${params}`, {
            method: 'GET',
            headers: {
                'X-Api-Key': NETWORKSDB_API
            }
        });

        const json = await r.json();
        console.log(json);

        const { organisation, network, asn } = json;
        const organisation_name = organisation.name;
        const { netname: network_name, description, first_ip: ip_start, last_ip: ip_end, cidr } = network;
        let as_number = null;
        if (asn && asn.asn)
            as_number = asn.asn;

        const start_int = IPtoInt(ip_start);
        const end_int = IPtoInt(ip_end);
        let id;

        try {
            const result = await db.run(
                "INSERT INTO Networks(organisation_name, network_name, description, ip_start, ip_end, start_int, end_int, ip_cidr, asn, clues) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [organisation_name, network_name, description, ip_start, ip_end, start_int, end_int, cidr, as_number, JSON.stringify(clues)],
            );
            id = result.lastID;
        } catch (error) {
            console.error("Error inserting into Networks:");
            console.error(error);
            return res.sendStatus(500);
        }

        net = {
            id,
            organisation_name,
            network_name,
            description,
            ip_start,
            ip_end,
            start_int,
            end_int,
            ip_cidr: cidr,
            asn: as_number,
            identified: 0,
        }
    }

    return res.json(net);
});

async function findDatacenters(net_id, country_code, level = 1) {
    console.log("findDatacenters");
    console.log(`${net_id} ${country_code} ${level}`);

    const fac_url_base = "https://peeringdb.com/api/netfac";
    const searchParams = new URLSearchParams({ net_id });

    if (country_code && level != 3) {
        if (level == 1) {
            searchParams.append('country__in', country_code);
        }
        else if (level == 2) {
            let neighbours = [country_code];
            for (const continent of Object.keys(CONTINENT_COUNTRY_LIST)) {
                if (CONTINENT_COUNTRY_LIST[continent].includes(country_code)) {
                    neighbours = CONTINENT_COUNTRY_LIST[continent];
                    break;
                }
            }
            searchParams.append('country__in', neighbours.join(','));
        }
    }

    let fac_url = `${fac_url_base}?${searchParams.toString()}`;
    console.log(fac_url);

    let fac_info = await fetch(fac_url).then(r => r.json()).catch(err => {
        console.error("Error fetching from peeringdb");
        console.error(err);
        return { data: [] };
    });

    fac_info.data.forEach((val, index) => {
        val['country_name'] = COUNTRY_CODE_TO_NAME[val.country];
        console.log(`${val.country_name}`);
        fac_info.data[index] = val
    });
    console.log(fac_info);

    return fac_info;
}

app.get('/api/datacenter', async (req, res) => {
    let { asn, country_code, level } = req.query;

    if (!country_code && level === undefined)
        level = 3;
    else if (country_code && level == undefined)
        level = 1;

    console.log(asn);
    console.log(country_code);
    console.log(level);

    if (!asn)
        return res.json([]);

    // Search local database for any info...
    const db = await dbPromise;
    const network = await db.get("SELECT * FROM Networks WHERE asn = ?", [asn]);

    if (!network) {
        console.log(`ASN ${asn} not known to this database`);
        return res.json([]);
    }

    // let query = `
    //     SELECT Datacenters.* FROM Datacenters 
    //     JOIN NetworksDatacenters ON Datacenters.id = NetworksDatacenters.datacenterId
    //     JOIN Networks ON NetworksDatacenters.networkId = Networks.id
    //     WHERE Networks.asn = ?
    // `;
    // let query_values = [asn];
    // if (country_code) {
    //     query += ' AND Datacenters.country_code LIKE ?';
    //     query_values.push(country_code);
    // }
    //
    // const facilities = await db.all(query, query_values);

    // if (!facilities || facilities.length == 0) {
    if (true) {
        const url = `https://peeringdb.com/api/net?asn=${asn}`;
        console.log(url);

        const net_info = await fetch(url).then(r => r.json());
        let net_id;
        try {
            net_id = net_info['data'][0]['id'];
        } catch (error) {
            console.error(`Error getting ASN id`);
            console.error(error);
            console.log(net_info);
            return res.json([]);
        }

        let fac_info = await findDatacenters(net_id, country_code, level);

        if (country_code) {
            while (level < 3 && (!fac_info || !fac_info.data || fac_info.data.length == 0)) {
                level += 1;
                console.log(`No Datacenters found, increasing level to ${level}`);
                fac_info = await findDatacenters(net_id, country_code, level)
            }
        }

        // await db.run("BEGIN TRANSACTION");
        // for (const fac of fac_info.data) {
        //     const result = await db.run("INSERT INTO Datacenters(fac_id, name, city, country_code) VALUES (?, ?, ?, ?)", [fac.fac_id, fac.name, fac.city, fac.country]);
        //     await db.run("INSERT INTO NetworksDatacenters(networkId, datacenterId) VALUES(?, ?)", [network.id, result.lastID]);
        // }
        // await db.run("COMMIT");

        if (fac_info.data.length) {
            console.log("Fetching location data of facilities");

            const fac_ids = fac_info.data.map(el => el.fac_id);
            const fac_url_base = "https://peeringdb.com/api/fac";
            const searchParams = new URLSearchParams();
            searchParams.append('id__in', fac_ids.join(','));
            let fac_url = `${fac_url_base}?${searchParams.toString()}`;
            console.log(fac_url);

            const fac_info_details = await fetch(fac_url)
                .then(res => res.json())
                .catch(err => {
                    console.log(err);
                    return fac_info;
                });

            fac_info_details.data.forEach((val, index) => {
                val['country_name'] = COUNTRY_CODE_TO_NAME[val.country];
                console.log(`${val.country_name}`);
                fac_info_details.data[index] = val
            });

            console.log(fac_info_details);
            return res.json(fac_info_details.data);
        } else {
            return res.json([]);
        }

    } else {
        // TODO Cache facility data in own database!
        return res.json(facilities);
    }

    return res.json([]);
});

app.post('/api/clue', async (req, res) => {
    const { ip } = req.query;
    const { clues } = req.body;

    console.log(ip);
    console.log(clues);

    if (!ip || isIP(ip) == 0)
        return res.sendStatus(400);

    if (isIPv6(ip)) {
        console.warn(`IPv6 not supported. ${ip}`)
        return res.sendStatus(400);
    }

    if (!clues || clues.length == 0)
        return res.sendStatus(200);

    console.log(clues);

    const ip_int = IPtoInt(ip);
    console.log(ip_int);
    if (isIpReserved(ip_int)) {
        return res.json({ reserved: true });
    }

    const db = await dbPromise;
    let network = await db.get("SELECT * FROM Networks WHERE ? BETWEEN start_int AND end_int", [ip_int]);

    if (!network)
        return res.sendStatus(200);

    const result = await db.run("UPDATE Networks SET clues = ? WHERE id = ?", [JSON.stringify(clues), network.id]);
    console.log(result.changes);

    return res.sendStatus(200);
});

app.post('/api/places', async (req, res, next) => {
    const { divisionType, divisionName, placeName } = req.body;
    if (!divisionType || !divisionName || !placeName) {
        return res.sendStatus(400);
    }

    const placeType = {
        'continent': 'country',
        'country': 'region',
        'region': 'city',
    }[divisionType];

    const db = await dbPromise;
    const divisionId = await db.get("SELECT id FROM Places WHERE type = ? AND name = ?", [divisionType, divisionName]);
    if (divisionId === undefined)
        return res.sendStatus(404);

    console.log(`Inserting ${placeName} (type ${placeType}) into ${divisionType} (${divisionId.id}) ${divisionName}`);

    await db.run("INSERT INTO Places(name, type, parent_id) VALUES (?, ?, ?)", [placeName, placeType, divisionId.id], (error) => {
        if (error)
            next(error);
    });

    return res.sendStatus(201);
});

async function batchUpload(rows) {
    const db = await dbPromise;

    let messages = [];
    let row_count = -1;
    let success_count = 0;
    for (const row of rows) {
        row_count += 1;
        let { title, url, source, sourceUrl, type, date, location, perspective, communities, impacts, companies, notes } = row;

        title = removeWhitespaceExceptSpace(title);
        source = removeWhitespaceExceptSpace(source);

        console.log(row);
        if (!title || title == undefined) {
            messages.push(`Row ${row_count}: "title" missing`);
            continue;
        }

        if (!url || url == undefined) {
            messages.push(`Row ${row_count}: "url" missing`);
            continue;
        }

        if (!source || source == undefined) {
            messages.push(`Row ${row_count}: "source" missing`);
            continue;
        }

        // Check if URL already exists
        url = fixUrl(url);
        const urlTest = await db.get("SELECT * FROM Articles WHERE url = ?", [url]);

        if (urlTest) {
            messages.push(`Row ${row_count}: "url" (${url}) already in database - duplicate article?`);
            continue;
        }

        // Check if source exists
        const sourceTest = await db.get("SELECT * FROM Sources WHERE name LIKE ?", [source]);
        let sourceId;
        if (!sourceTest) {
            // Not in source database, add it if possible...
            sourceUrl = fixUrl(sourceUrl);
            if (!sourceUrl || sourceUrl == undefined) {
                messages.push(`Row ${row_count}: New "source", but "sourceUrl" not provided`);
                continue;
            }

            await db.run("INSERT INTO Sources(name, url) VALUES (?, ?)", [source, sourceUrl], (error) => {
                console.log("Error adding new source: " + error);
                messages.push(`Row ${row_count}: Error adding source.`);
            }).then(result => {
                sourceId = result.lastID;
            });
        } else {
            // Source in database
            sourceId = sourceTest.id;
        }

        // Check type
        if (type)
            type = removeWhitespaceExceptSpace(type).toLowerCase();
        else
            type = "article";

        // Check perspective
        const perspectiveTest = await db.get("SELECT * FROM Perspectives WHERE name LIKE ?", [perspective]);
        let perspectiveId;
        if (perspectiveTest) {
            perspectiveId = perspectiveTest.id;
        }

        // Check companies
        let companiesIds = await getTagListIds(db, 'Companies', companies);

        // Check impacts
        let impactsIds = await getTagListIds(db, 'Impacts', impacts);

        // Check communities
        let communitiesIds = await getTagListIds(db, 'Communities', communities);

        // Check location
        const locationData = parseLocationString(location);
        let continent, country, region;
        let locationString = '';
        if (locationData.continent) {
            const continentTest = await db.get("SELECT * FROM Places WHERE type = ? AND name LIKE ?", ['continent', locationData.continent]);
            if (continentTest) {
                continent = continentTest.id;
                locationString = continentTest.name;
            }
        }

        if (continent != undefined && locationData.country) {
            const countryTest = await db.get("SELECT * FROM Places WHERE type = ? AND name LIKE ?", ['country', locationData.country]);
            if (countryTest) {
                country = countryTest.id;
                locationString += '/' + countryTest.name;
            }
        }

        if (country != undefined && locationData.region) {
            const regionTest = await db.get("SELECT * FROM Places WHERE type = ? AND name LIKE ?", ['region', locationData.region]);
            if (regionTest) {
                region = regionTest.id;
                locationString += '/' + regionTest.name;
            }
        }

        date = removeWhitespaceExceptSpace(date);
        notes = removeWhitespaceExceptSpace(notes);

        // Add new entry
        const addedBy = "CSV";
        const nowDate = new Date();
        let year = new Intl.DateTimeFormat('en', { year: 'numeric' }).format(nowDate);
        let month = new Intl.DateTimeFormat('en', { month: '2-digit' }).format(nowDate);
        let day = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(nowDate);
        const addDate = `${day}/${month}/${year}`;

        let articleId;
        await db.run(
            "INSERT INTO Articles(title, url, type, source, date, perspective, continent, country, region, location, notes, addedBy, addDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [title, url, type, sourceId, date, perspectiveId, continent, country, region, locationString, notes, addedBy, addDate],
            (error) => {
                console.err(error);
                messages.push(`Row ${row_count}: Error inserting article`);
            }).then(result => {
                articleId = result.lastID;
            });

        console.log(`New article id: ${articleId}`);
        // Update XRef tables
        if (companiesIds) {
            await db.run("BEGIN TRANSACTION");
            for (const companyId of companiesIds) {
                await db.run("INSERT INTO ArticlesCompanies(articleId, companyId) VALUES (?, ?)", [articleId, companyId]);
            }
            await db.run("COMMIT");
        }

        if (impactsIds) {
            await db.run("BEGIN TRANSACTION");
            for (const impactId of impactsIds) {
                await db.run("INSERT INTO ArticlesImpacts(articleId, impactId) VALUES (?, ?)", [articleId, impactId]);
            }
            await db.run("COMMIT");
        }

        if (communitiesIds) {
            await db.run("BEGIN TRANSACTION");
            for (const communityId of communitiesIds) {
                await db.run("INSERT INTO ArticlesCommunities(articleId, communityId) VALUES (?, ?)", [articleId, communityId]);
            }
            await db.run("COMMIT");
        }

        messages.push(`Row ${row_count}: Sucessfully added`)
        success_count += 1;

        updateVersion(db);
    }

    if (success_count) {
        console.log(`Sucessfully added ${success_count} articles!`);
        messages.push(`Sucessfully added ${success_count} article${success_count > 1 ? 's' : ''}!`);
    } else {
        messages.push("Did not add any articles. Please check the CSV file for the errors given above.");
    }

    return messages;
}

async function getTagListIds(db, table, tagsString) {
    const tagList = tagsString.split(',');
    const tagIds = [];
    for (let tag of tagList) {
        tag = tag.trim();
        const tagTest = await db.get(`SELECT * FROM ${table} WHERE name LIKE ?`, [tag]);
        if (tagTest)
            tagIds.push(tagTest.id);
        else {
            await db.run(`INSERT INTO ${table}(name) VALUES (?)`, [tag], (error) => {
                console.error(`Error adding "${tag}" to ${table}: ` + error);
                messages.push(`Row ${row_count}: Error adding "${tag}" to ${table}`);
            }).then(result => {
                if (result.lastID != undefined)
                    tagIds.push(result.lastID);
            });
        }
    }

    return tagIds;
}

// Start Server
const setup = async () => {
    const db = await dbPromise;
    await db.migrate();

    let result = await db.all("PRAGMA user_version", []);
    console.log("user_version: ");
    user_version = result[0].user_version;
    console.log(user_version);

    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}${ROOT}`);
    });
}

setup();

async function updateVersion(db) {
    console.log("updateVersion()");

    user_version = Math.floor(Date.now() / 1000);
    await db.run(`PRAGMA user_version = ${user_version}`, [], (err) => {
        console.log(err);
    });
}

function fuzzySearch(items, query, keys = ['title', 'companies']) {
    const fuse = new Fuse(items, {
        keys,
        threshold: 0.2,
        useTokenSearch: true,
        includeScore: true,
        ignoreLocation: true,
        includeMatches: true,
        minMatchCharLength: 2,
    });

    return fuse.search(query).map(({ item, score }) => ({
        ...item,
        _score: score,  // lower = better match
    }));
}

function removeWhitespaceExceptSpace(str) {
    /* 
    Matches all whitespace characters except regular space (" ").
    Includes:
        \t (tab), \n (newline), \r (carriage return), \f (form feed), \v (vertical tab).
        Unicode whitespaces like \u00A0 (non-breaking space), \u2000-\u200A (various spaces), etc.
    */
    return str.trim().replace(/[\t\n\r\f\v\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g, '');
}

function fixUrl(url) {
    if (!url) return ''

    url = url.trim();
    if (!url) return ''

    if (!/^https?:\/\//i.test(url))
        return 'http://' + url;
    return url;
}

function parseLocationString(location) {
    let result = {};
    if (!location || location.toLowerCase() === 'worldwide' || location.toLowerCase() === 'all') {
        return result;
    }

    let splits = location.split('/');
    if (!splits[0])
        splits = splits.shift();

    function checkAll(place) {
        if (!place || place.toLowerCase() === 'all' || place === 'undefined')
            return undefined;
        return place;
    }

    result.continent = checkAll(splits[0]);
    result.country = checkAll(splits[1]);
    result.region = checkAll(splits[2]);

    if (result.continent) {
        result.location = result.continent;
        if (result.country) {
            result.location += '/' + result.country;
            if (result.region) {
                result.location += '/' + result.region;
            }
        }
    }

    return result;
}


