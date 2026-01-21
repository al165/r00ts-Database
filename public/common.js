let sources = {};
let sourcesPromise = fetch(`${ROOT || ''}/api/sources`).then(res => {
    return res.json()
}).then(data => {
    for (const item of Object.keys(data))
        sources[data[item].id] = data[item];
});

let companies = {};
let companiesPromise = fetch(`${ROOT || ""}/api/companies`).then(res => {
    return res.json()
}).then(data => {
    for (const item of Object.keys(data))
        companies[data[item].id] = data[item];
});

let impacts = {};
let impactsPromise = fetch(`${ROOT || ""}/api/impacts`).then(res => {
    return res.json()
}).then(data => {
    for (const item of Object.keys(data))
        impacts[data[item].id] = data[item];
});

let communities = {};
let communitiesPromise = fetch(`${ROOT || ''}/api/communities`).then(res => {
    return res.json()
}).then(data => {
    for (const item of Object.keys(data))
        communities[data[item].id] = data[item];
});

let articles = {};

window.fieldRender = {
    id: (item) => {
        return `<th scope="row">${item.id}</th>`
    },
    title: (item) => {
        return `<td><a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.title}</a></td>`;
    },
    type: (item) => {
        return `<td>${item.type}</td>`;
    },
    source: (item) => {
        if (sources[item.source]) {
            const sourceData = sources[item.source];
            return `<td><a href="${sourceData.url}" target="_blank" rel="noopener noreferrer">${sourceData.name}</a></td>`;
        } else
            return `<td>unknown</td>`;
    },
    date: (item) => {
        return `<td>${item.date}</td>`;
    },
    companies: (item) => {
        if (item.companies)
            return '<td>' + item.companies.map(c => c.name).join(', ') + '</td>';
        else
            return '<td></td>';
    },
    communities: (item) => {
        if (item.communities)
            return '<td>' + item.communities.map(c => c.name).join(', ') + '</td>';
        else
            return '<td></td>';
    },
    impacts: (item) => {
        if (item.impacts)
            return '<td>' + item.impacts.map(i => i.name).join(', ') + '</td>';
        else
            return '<td></td>';
    },
    location: (item) => {
        return `<td>${item.location}</td>`;
    }

};

function addRow(item, tr = undefined, fields = []) {
    let updating = true;
    if (!tr) {
        updating = false;
        tr = document.createElement('tr');
    }

    const tds = [];

    for (const field of fields) {
        if (!window.fieldRender[field]) {
            console.log('Field not found in fieldRender');
            tds.push('<td></td>');
            continue;
        }

        tds.push(fieldRender[field](item));
    }

    tr.innerHTML = tds.join(' ');

    if (!updating) {
        const resultsContainer = document.getElementById('result-table');
        resultsContainer.appendChild(tr);
    }

    return tr;
}

const headings = document.querySelectorAll('#result-headings th');
const fields = [...headings].map(el => el.innerText);

function renderResults(items) {
    const resultsContainer = document.getElementById('result-table');

    if (items.length === 0) {
        resultsContainer.innerHTML = '<tr><td colspan="10" class="text-center">No articles found!</td></tr>';
        return;
    }

    resultsContainer.innerHTML = '';
    items.forEach(item => {
        addRow(item, undefined, fields);
    });
}

// Fetch article list
async function fetchItems(page = 1, searchParams = {}) {
    const params = new URLSearchParams();
    params.append('page', page);
    params.append('limit', 100);

    for (const key of Object.keys(searchParams)) {
        params.append(key, searchParams[key]);
    }

    fetch(`${ROOT || ''}/api/search?${params.toString()}`)
        .then(res => res.json())
        .then(data => {
            articles = {};
            data.articles.forEach(item => {
                articles[item.id] = item;
            });
            renderResults(data.articles);
        });
}