-- Up

CREATE TABLE Networks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    network_name TEXT NOT NULL,
    organisation_name TEXT NOT NULL,
    description TEXT,
    ip_start TEXT NOT NULL,
    start_int INTEGER NOT NULL,
    ip_end TEXT NOT NULL,
    end_int INTEGER NOT NULL,
    ip_cidr TEXT NOT NULL UNIQUE,
    asn INTEGER,
    clues TEXT
);

CREATE TABLE Datacenters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fac_id INTEGER UNIQUE,
    identified INTEGER NOT NULL DEFAULT 0,
    name TEXT,
    lat NUMBER,
    lon NUMBER,
    links TEXT,
    city TEXT,
    country_code TEXT,
    last_update INTEGER
);

CREATE TABLE NetworksDatacenters (
    networkId INTEGER,
    datacenterId INTEGER,
    FOREIGN KEY(networkId) REFERENCES Networks(id),
    FOREIGN KEY(datacenterId) REFERENCES Datacenters(id),
    PRIMARY KEY (networkId, datacenterId)
);

CREATE INDEX idx_ip_ranges_start ON Networks (start_int);
CREATE INDEX idx_ip_ranges_end ON Networks (end_int);

-- Down

DROP INDEX idx_ip_ranges_start;
DROP INDEX idx_ip_ranges_end;
DROP TABLE Datacenters;
DROP TABLE Networks;
DROP TABLE NetworksDatacenters;

