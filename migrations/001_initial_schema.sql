-- Up

CREATE TABLE Articles(
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    type TEXT NOT NULL,
    source INTEGER,
    date TEXT,
    continent INTEGER,
    country INTEGER,
    region INTEGER,
    city INTEGER,
    location TEXT,
    addedBy TEXT,
    addDate TEXT,
    FOREIGN KEY (source) REFERENCES Sources(id),
    FOREIGN KEY (continent) REFERENCES Place(id),
    FOREIGN KEY (country) REFERENCES Place(id),
    FOREIGN KEY (region) REFERENCES Place(id),
    FOREIGN KEY (city) REFERENCES Place(id)
);

CREATE TABLE Sources(
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    url TEXT NOT NULL
);

CREATE TABLE Impacts(
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE Communities(
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE Places (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (
        type IN ('continent', 'country', 'region', 'city')
    ),
    parent_id INTEGER,
    FOREIGN KEY (parent_id) REFERENCES Place(id)
);

CREATE TABLE ArticlesImpacts(
    articleId INTEGER,
    impactId INTEGER,
    FOREIGN KEY (articleId) REFERENCES Articles(id),
    FOREIGN KEY (impactId) REFERENCES Impacts(id),
    PRIMARY KEY (articleId, impactId)
);

CREATE TABLE ArticlesCommunities(
    articleId INTEGER,
    communityId INTEGER,
    FOREIGN KEY (articleId) REFERENCES Articles(id),
    FOREIGN KEY (communityId) REFERENCES Communities(id),
    PRIMARY KEY (articleId, communityId)
);

-- Down

DROP TABLE Articles;
DROP TABLE Sources;
DROP TABLE Impacts;
DROP TABLE Communities;
DROP TABLE Place;
DROP TABLE ArticlesImpacts;
DROP TABLE ArticlesCommunities;

