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

let perspectives = {};
let perspectivesPromise = fetch(`${ROOT || ''}/api/perspectives`).then(res => {
    return res.json();
}).then(data => {
    for (const item of Object.keys(data))
        perspectives[data[item].id] = data[item];
})

let articles = {};

let continentList = [];
let countryList = [];
let regionList = [];

function fillPlaceList(placeEl, data, placeholder) {
    if (Object.keys(data).length == 0) {
        placeEl.setAttribute("disabled", true);
        placeEl.innerHTML = `<option>${placeholder}</option>`;
        return;
    }

    placeEl.removeAttribute("disabled");
    placeEl.innerHTML = '<option value="">All</option>';
    for (const item of Object.values(data)) {
        const option = document.createElement('option');
        option.innerText = item['name'];
        option.value = item['id'];
        placeEl.appendChild(option);
    }
}

function initLocationList(continentListSelect, countryListSelect, regionListSelect) {

    continentListSelect.addEventListener('change', _ev => {
        regionListSelect.setAttribute('disabled', true);
        regionListSelect.innerHTML = '<option value="">Region</option>';

        if (!continentListSelect.selectedOptions[0].value) {
            countryListSelect.setAttribute('disabled', true);
            countryListSelect.innerHTML = '<option value="">Country</option>';
        } else {
            countryListSelect.innerHTML = '<option value="" selected>All</option>';
            countryListSelect.removeAttribute('disabled');
            const selectedContinent = continentListSelect.selectedOptions[0].innerText;

            getPlaceList('continent', selectedContinent).then(data => {
                countryList = data;
                fillPlaceList(countryListSelect, data, "Country");
            });
        }
    });

    countryListSelect.addEventListener('change', _ev => {
        if (countryListSelect.selectedOptions[0].value == -1) {
            regionListSelect.setAttribute('disabled', true);
            regionListSelect.innerHTML = '<option value="">Region</option>';
        } else {
            regionListSelect.innerHTML = '<option value="" selected>All</option>';
            regionListSelect.removeAttribute('disabled');
            const selectedCountry = countryListSelect.selectedOptions[0].innerText;

            getPlaceList('country', selectedCountry).then(data => {
                regionList = data;
                fillPlaceList(regionListSelect, data, "Region");
            });
        }
    });
}

function fillOptionList(selectElem, data, clear = true, value = 'id', key = 'name', option_type = 'option') {
    if (clear)
        selectElem.innerHTML = '';

    for (const item of Object.values(data)) {
        const option = document.createElement(option_type);
        option.innerText = item[key];
        option.value = item[value];
        selectElem.appendChild(option);
    }
}

function initMultiselect(multiselect, update_label = true) {
    const options = multiselect.querySelectorAll("option");
    for (const option of options) {
        option.onmousedown = ev => {
            ev.preventDefault();
            multiselect.focus();
            option.selected = !option.selected;
            multiselect.dispatchEvent(new Event('change'));
            return false;
        };
    }

    if (update_label) {
        multiselect.addEventListener('change', _ev => {
            let selected = [];
            for (const option of options) {
                if (option.selected)
                    selected.push(option.innerText);
            }

            let label = 'None';
            if (selected.length) {
                label = selected.join(', ');
            }

            multiselect.previousSibling.previousSibling.innerText = label;
        });
    }
}

async function getPlaceList(divisionType, divisionName, placeId = "") {
    if (!divisionName || divisionName === "All")
        return [];
    return fetch(`${ROOT || ''}/api/places?divisionType=${divisionType}&divisionName=${divisionName}&placeId=${placeId}`)
        .then(res => {
            return res.json()
        });
}

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
    perspective: (item) => {
        if (item.perspective)
            return `<td>${perspectives[item.perspective].name}</td>`;
        else
            return '<td>Unknown</td>';
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
    },
    notes: (item) => {
        return `<td>${item.notes || ''}</td>`;
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

function search() {
    const searchParams = {};

    if (document.querySelector("#approved")) {
        if (document.querySelector("#approved-only").checked)
            searchParams.approved = 1;
        else if (document.querySelector("#approved-none").checked)
            searchParams.approved = 0;
    }

    function addSelectedItem(select, param_name) {
        if (select && select.selectedIndex > 0)
            searchParams[param_name] = select.selectedOptions[0].value;
    }

    function addMultiselectItems(multiselect, param_name) {
        if (!multiselect || multiselect.selectedOptions.length == 0) return;

        searchParams[param_name] = [];
        for (const item of multiselect.selectedOptions) {
            searchParams[param_name].push(item.value);
        }
    }

    addSelectedItem(document.querySelector("#filter-type"), 'type');
    addSelectedItem(document.querySelector("#filter-source"), 'source');
    addSelectedItem(document.querySelector("#filter-perspective"), 'perspective');
    addSelectedItem(document.querySelector("#filter-continent"), 'continent');
    addSelectedItem(document.querySelector("#filter-country"), 'country');
    addSelectedItem(document.querySelector("#filter-region"), 'region');

    addMultiselectItems(document.querySelector("#filter-companies"), 'companies');
    addMultiselectItems(document.querySelector("#filter-impacts"), 'impacts');
    addMultiselectItems(document.querySelector("#filter-communities"), 'communities');

    fetchItems(1, searchParams);
}

// Fetch article list
async function fetchItems(page = 1, searchParams = {}) {
    const params = new URLSearchParams();
    params.append('page', page);
    params.append('limit', 100);

    for (const key of Object.keys(searchParams)) {
        const value = searchParams[key];
        if (Array.isArray(value)) {
            for (const val of value)
                params.append(key, val);
        } else
            params.append(key, value);
    }

    console.log(params);

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

document.addEventListener('DOMContentLoaded', () => {

    // Places
    const continentFilter = document.querySelector('select[name="filter-continent"]');
    const countryFilter = document.querySelector('select[name="filter-country"]');
    const regionFilter = document.querySelector('select[name="filter-region"]');

    initLocationList(continentFilter, countryFilter, regionFilter);

    fetch(`${ROOT || ''}/api/places/continents`).then(res => {
        return res.json()
    }).then(data => {
        continentList = data;
        fillOptionList(continentFilter, data, false);
    });

    document.querySelector("#search-btn").addEventListener('click', ev => {
        ev.preventDefault();
        search();
    });
});
