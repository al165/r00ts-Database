import express from 'express';
import session from 'express-session';

import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

import { config } from 'dotenv';

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

const USER = {
    username: process.env.USERNAME,
    password: process.env.PASSWORD
};

// Authentication Middleware
function isAuthenticated(req, res, next) {
    if (req.session.user && req.session.user.password === USER.password)
        return next();
    res.redirect(path.join(ROOT, '/login'));
}

// Routes
app.get('/login', (req, res) => {
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

app.get('/dashboard', isAuthenticated, async (req, res) => {
    const db = await dbPromise;
    const articles = await db.all('SELECT * FROM Articles');
    const sources = await db.all('SELECT * FROM Sources');
    const impacts = await db.all('SELECT * FROM Impacts');
    const communities = await db.all('SELECT * FROM Communities');

    res.render('dashboard', { root: ROOT, articles, sources, impacts, communities, user_version });
});

app.get('/', async (req, res) => {
    const db = await dbPromise;
    const articles = await db.all('SELECT * FROM Articles');
    const sources = await db.all('SELECT * FROM Sources');
    const impacts = await db.all('SELECT * FROM Impacts');
    const communities = await db.all('SELECT * FROM Communities');

    return res.render('home', { root: ROOT, articles, sources, impacts, communities, user_version });
});


// API Endpoints
app.get('/api/search', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
});

app.get('/api/sources', async (req, res) => {
    const db = await dbPromise;
    const sources = await db.all("SELECT * FROM Sources");

    return res.json(sources);
});

app.get('/api/impacts', async (req, res) => {
    const db = await dbPromise;
    const impacts = await db.all("SELECT * FROM Impacts");

    return res.json(impacts);
});

app.get('/api/communities', async (req, res) => {
    const db = await dbPromise;
    const communities = await db.all("SELECT * FROM Communities");

    return res.json(communities);
});

app.post('/api/add', isAuthenticated, async (req, res) => {
    console.log("POST /api/add");

    console.log(req.body);

    let { title, url, date, source, type, impacts, communities, continent, country, region, city } = req.body;

    if (continent) continent = parseInt(continent);
    if (country) country = parseInt(country);
    if (region) region = parseInt(region);
    if (city) city = parseInt(city);

    if (!title || !url)
        return res.sendStatus(400);

    const db = await dbPromise;

    if (!/^https?:\/\//i.test(url))
        url = 'http://' + url;

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
        console.log(row);
        if (row && row.name)
            location += row.name;
    }

    if (country != undefined && country >= 0) {
        const row = await db.get("SELECT * FROM Places WHERE id = ?", [country]);
        console.log(row);
        if (row && row.name)
            location += '/' + row.name;
    }

    if (region != undefined && region >= 0) {
        const row = await db.get("SELECT * FROM Places WHERE id = ?", [region]);
        console.log(row);
        if (row && row.name)
            location += '/' + row.name;
    }

    if (city != undefined && city >= 0) {
        const row = await db.get("SELECT * FROM Places WHERE id = ?", [city]);
        console.log(row);
        if (row && row.name)
            location += '/' + row.name;
    }


    let articleId;
    await db.run(
        "INSERT INTO Articles(title, url, type, source, date, continent, country, region, city, location, addedBy, addDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [title, url, type, source, date, continent, country, region, city, location, addedBy, addDate],
        (error) => {
            next(error);
        }).then(result => {
            articleId = result.lastID;
        });

    console.log(`Inserted ArticleID: ${articleId}`);

    // Update XRef tables

    if (impacts) {
        await db.run("BEGIN TRANSACTION");
        for (const impactId of impacts) {
            console.log(" Impact id: " + impactId);
            await db.run("INSERT INTO ArticlesImpacts(articleId, impactId) VALUES (?, ?)", [articleId, impactId]);
        }
        await db.run("COMMIT");
    }

    if (communities) {
        await db.run("BEGIN TRANSACTION");
        for (const communityId of communities) {
            console.log(" Community id: " + communityId);
            await db.run("INSERT INTO ArticlesCommunities(articleId, communityId) VALUES (?, ?)", [articleId, communityId]);
        }
        await db.run("COMMIT");
    }

    updateVersion(db);

    console.log("DONE");

    return res.sendStatus(201);
});

app.post('/api/source', isAuthenticated, async (req, res, next) => {
    console.log('POST /api/souce');
    console.log(req.body);

    const newSource = removeWhitespaceExceptSpace(req.body.newSource);
    if (newSource.length == 0)
        try {
            throw new Error('Invalid source name');
        } catch (error) {
            next(error);
        }

    const newSourceURL = req.body.newSourceURL;
    if (!newSourceURL || newSourceURL.length == 0)
        try {
            throw new Error('Invalid source URL');
        } catch (error) {
            next(error);
        }

    const db = await dbPromise;
    await db.run("INSERT INTO Sources(name, url) VALUES (?, ?)", [newSource, newSourceURL], (error) => {
        next(error);
    });

    const newSourceData = {
        name: newSource,
        url: newSourceURL,
        id: db.lastInsertRowId
    };

    await updateVersion(db);

    return res.status(201).json(newSourceData);
});

app.post('/api/impacts', isAuthenticated, async (req, res) => {
    console.log('POST /api/impacts');

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

app.post('/api/communities', isAuthenticated, async (req, res) => {
    console.log('POST /api/communities');

    const newCommunity = removeWhitespaceExceptSpace(req.body.name);
    if (newCommunity.length == 0)
        try {
            throw new Error('Invalid impact name');
        } catch (error) {
            next(error);
        }

    const db = await dbPromise;
    await db.run("INSERT INTO Communities(name) VALUES (?)", [newCommunity], (error) => {
        next(error);
    });

    const newCommunityData = {
        name: newCommunity,
        id: db.lastInsertRowId
    };

    await updateVersion(db);

    return res.status(201).json(newCommunityData);
});

app.get('/api/places/continents', async (req, res) => {
    const db = await dbPromise;
    const continents = await db.all("SELECT * FROM Places WHERE type = 'continent'");

    return res.json(continents);
});

app.get('/api/places', async (req, res) => {
    console.log('GET /api/places');

    const { divisionType, divisionName } = req.query;
    if (!divisionType || !divisionName)
        return res.sendStatus(400);

    const db = await dbPromise;

    const divisionId = await db.get("SELECT id FROM Places WHERE type = ? AND name = ?", [divisionType, divisionName]);
    if (divisionId === undefined || divisionId.id === undefined)
        return res.sendStatus(404);

    const places = await db.all("SELECT * FROM Places WHERE parent_id = ? ORDER BY name ASC", [divisionId.id]);
    console.log(places);

    return res.json(places);
});

app.post('/api/places', async (req, res, next) => {
    console.log("POST /api/places");
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

    console.log(divisionId);

    console.log(`Inserting ${placeName} (type ${placeType}) into ${divisionType} (${divisionId.id}) ${divisionName}`);

    await db.run("INSERT INTO Places(name, type, parent_id) VALUES (?, ?, ?)", [placeName, placeType, divisionId.id], (error) => {
        if (error)
            next(error);
    });

    return res.sendStatus(201);
});


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

function removeWhitespaceExceptSpace(str) {
    /* 
    Matches all whitespace characters except regular space (" ").
    Includes:
        \t (tab), \n (newline), \r (carriage return), \f (form feed), \v (vertical tab).
        Unicode whitespaces like \u00A0 (non-breaking space), \u2000-\u200A (various spaces), etc.
    */
    return str.trim().replace(/[\t\n\r\f\v\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g, '');
}