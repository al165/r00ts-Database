-- UP

ALTER TABLE Articles ADD notes TEXT;
ALTER TABLE Articles ADD perspective INTEGER;

CREATE TABLE Perspectives(
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
);

INSERT INTO Perspectives(name) VALUES ("Unknown");
INSERT INTO Perspectives(name) VALUES ("Neutral");
INSERT INTO Perspectives(name) VALUES ("Advocate");
INSERT INTO Perspectives(name) VALUES ("Against");

-- Down

ALTER TABLE Articles DROP COLUMN notes;
ALTER TABLE Articles DROP COLUMN perspective;
DROP TABLE Perspectives;
