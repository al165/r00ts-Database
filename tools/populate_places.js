import fs from 'fs';
import csv from 'csv-parser';

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

import continents from './continents.min.json' with { type: "json" };

// Open database
let dbPromise = open({
    filename: '../data.db',
    driver: sqlite3.Database
});

let db = await dbPromise;

// Clear table
await db.run("DELETE FROM Places");
await db.run("VACUUM");

let insert = await db.prepare(`
  INSERT OR IGNORE INTO Places (name, type, parent_id)
  VALUES (?, ?, ?)
`);

// Continents
console.log("Seeding continents...");
await new Promise((resolve, reject) => {
    const dbi = db.getDatabaseInstance();
    dbi.serialize(() => {
        dbi.run('BEGIN TRANSACTION');

        for (const key of Object.keys(continents)) {
            insert.run(continents[key], 'continent', null);
        }

        dbi.run('COMMIT', (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
});

let continentIds = {};
for (const continent of await db.all("SELECT * FROM Places WHERE type=?", ['continent'])) {
    continentIds[continent.name] = continent.id;
}

// Countries
console.log("Seeding countries...");
let countryISOs = {};
await new Promise((resolve, reject) => {
    const dbi = db.getDatabaseInstance();
    dbi.serialize(() => {
        dbi.run('BEGIN TRANSACTION');

        fs.createReadStream('countries.csv')
            .pipe(csv())
            .on('data', (row) => {
                const continentId = continentIds[row.Continent];
                countryISOs[row.Name] = row.Code;
                insert.run(
                    row.Name,
                    'country',
                    continentId
                );
            })
            .on('end', () => {
                insert.finalize().then(() => {
                    dbi.run('COMMIT', (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                }).catch(reject)
            })
            .on('error', reject);
    });
});

let ISOIds = {};
for (const country of await db.all("SELECT * FROM Places WHERE type=?", ['country'])) {
    ISOIds[countryISOs[country.name]] = country.id;
}
console.log(ISOIds);

// Regions
console.log("Seeding regions...");

const insertRegion = await db.prepare(`
  INSERT OR IGNORE INTO Places (name, type, parent_id)
  VALUES (?, ?, ?)
`);

await new Promise((resolve, reject) => {
    const dbi = db.getDatabaseInstance();
    dbi.serialize(() => {
        dbi.run('BEGIN TRANSACTION');
        fs.createReadStream('subdivisions.csv')
            .pipe(csv())
            .on('data', (row) => {
                const countryId = ISOIds[row.country_code_alpha2];
                insertRegion.run(
                    row.subdivision_name,
                    'region',
                    countryId
                );
            })
            .on('end', () => {
                insertRegion.finalize().then(() => {
                    console.log("insert finalised");
                    dbi.run('COMMIT', (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                }).catch(reject);
            })
            .on('error', reject);
    });
});

console.log("done");
await db.close();