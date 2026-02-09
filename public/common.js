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

function setSelectOption(selectEl, values, multiselect = false, dispatch = true) {
    if (values == undefined)
        return []

    if (!Array.isArray(values)) {
        values = [values];
    }

    values = values.map(el => el.toString());

    let keys = []

    for (const option of selectEl.querySelectorAll("option")) {
        if (values.includes(option.value)) {
            option.selected = true;
            keys.push(option.innerText);
            if (!multiselect)
                break;
        }
        else
            option.selected = false;
    }

    if (dispatch)
        selectEl.dispatchEvent(new Event('change'));

    return keys;
}

async function setPlaceSelect(continentId, countryId, regionId, cityId) {
    const articleForm = document.querySelector("#add-article");
    const continentSelect = articleForm.querySelector("[name=continent]");
    const countryListSelect = articleForm.querySelector("[name=country]");
    const regionListSelect = articleForm.querySelector("[name=region]");

    if (continentId != undefined && continentId != null && continentId != "") {
        const continentName = setSelectOption(continentSelect, continentId, false, false)[0];
        const countryList = await getPlaceList('continent', continentName);
        fillPlaceList(countryListSelect, countryList, "Country");
    } else {
        continentSelect.selectedIndex = 0;
        continentSelect.dispatchEvent(new Event('change'));
        return;
    }

    if (countryId != undefined && countryId != null && countryId != "") {
        const countryName = setSelectOption(countryListSelect, countryId, false, false)[0];
        const regionList = await getPlaceList('country', countryName);
        fillPlaceList(regionListSelect, regionList, "Country");
    } else {
        countryListSelect.selectedIndex = 0;
        countryListSelect.dispatchEvent(new Event('change'));
        return;
    }

    if (regionId != undefined && regionId != null && regionId != "") {
        setSelectOption(regionListSelect, regionId, false, false)[0];
        // const cityList = await getPlaceList('country', countryName);
        // fillPlaceList(regionListSelect, regionList, "Country");
    } else {
        regionListSelect.selectedIndex = 0;
        regionListSelect.dispatchEvent(new Event('change'));
        return;
    }
}

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

function resetButton(text = "Add") {
    const submitButton = document.querySelector("#send-article");
    submitButton.disabled = false;
    submitButton.innerHTML = text;
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

function newArticle() {
    const articleForm = document.querySelector("#add-article");
    articleForm.querySelector("#send-article").onclick = sendNewArticle;

    articleForm.querySelector("[name=id]").value = "";
    articleForm.querySelector("[name=title]").value = "";
    articleForm.querySelector("[name=url]").value = "";
    articleForm.querySelector("[name=date]").value = "";
    articleForm.querySelector("[name=type]").selectedIndex = 0;
    articleForm.querySelector("[name=source]").selectedIndex = 0;
    articleForm.querySelector("[name=perspective]").selectedIndex = 0;
    articleForm.querySelector("[name=notes]").value = '';

    const companies = articleForm.querySelector("[name=companies]");
    setSelectOption(companies, [], true, true);

    const impacts = articleForm.querySelector("[name=impacts]");
    setSelectOption(impacts, [], true, true);

    const communities = articleForm.querySelector("[name=communities]");
    setSelectOption(communities, [], true, true);

    setPlaceSelect();

    articleForm.querySelector("#send-article").innerText = "Add";
    articleForm.querySelector("#delete-article").classList.add('invisible');
}

function closeModal() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('add-modal'));
    modal.hide();
}

async function sendNewArticle(ev) {
    console.log('sendNewArticle');
    ev.preventDefault();

    const formData = new FormData(document.querySelector("#add-article"));

    const submitButton = document.querySelector("#send-article");
    submitButton.disabled = true;
    submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span><span class="sr-only">Sending...</span>';

    try {
        await fetch(`${ROOT || ''}/api/article`, {
            method: "POST",
            body: formData,
        }).then(res => {
            return res.json();
        }).then(newRow => {
            resetButton();
            closeModal();

            articles[newRow.id] = newRow;
            const rowEl = addRow(newRow, undefined, fields);
            rowEl.classList.add('table-success');

        }).catch(err => {
            resetButton();
            closeModal();

            console.error(err);

            const errorModal = new bootstrap.Modal('#message-modal');
            const errorBody = document.querySelector("#message-body");
            errorBody.innerText = err;
            errorModal.show();
        });
    } catch (e) {
        console.error(e);
        resetButton();
        closeModal();

        const errorModal = new bootstrap.Modal('#message-modal');
        const errorBody = document.querySelector("#message-body");
        errorBody.innerText = err;
        errorModal.show();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    [...tooltipTriggerList].map(
        tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl, {
            delay: {
                "show": 1000,
                "hide": 100
            }
        })
    );

    const dateElem = document.querySelector('input[name="date"]');
    const _datepicker = new Datepicker(dateElem, {
        autohide: true,
        buttonClass: 'btn',
        clearButton: true,
        format: 'dd/mm/yyyy'
    });

    this.document.querySelector("#add-article-btn").addEventListener('click', () => {
        newArticle();
    });

    // Source List
    const sourceListSelect = document.querySelector("#article-source");

    const addSourceName = document.querySelector("#new-source-name");
    const addSourceURL = document.querySelector("#new-source-url");
    const addSourceSubmit = document.querySelector("#new-source-submit");

    addSourceName.addEventListener('input', (_event) => {
        if (addSourceName.value && addSourceURL.value)
            addSourceSubmit.removeAttribute('disabled');
        else
            addSourceSubmit.setAttribute('disabled', true);
    });

    addSourceURL.addEventListener('input', (_event) => {
        if (addSourceName.value && addSourceURL.value)
            addSourceSubmit.removeAttribute('disabled');
        else
            addSourceSubmit.setAttribute('disabled', true);
    });

    addSourceSubmit.addEventListener("click", async (event) => {
        event.preventDefault();
        const data = {
            newSource: addSourceName.value,
            newSourceURL: addSourceURL.value,
        }
        try {
            const response = await fetch(`${ROOT || ''}/api/source`, {
                method: "POST",
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data),
            });

            if (response.ok) {
                // update sources list and select option
                const newEntry = await response.json();

                addSourceName.value = "";
                addSourceURL.value = "";

                const option = document.createElement('option');
                option.value = newEntry.id;
                option.innerText = newEntry.name;
                option.selected = true;
                sourceListSelect.appendChild(option);
            }
        } catch (e) {
            console.error(e);
        }
    });

    // Companies
    const companiesSelect = document.querySelector("#companies-select");
    const newCompanyName = document.querySelector("#new-company-name");
    const newCompanySubmit = document.querySelector("#new-company-submit");

    newCompanySubmit.addEventListener('click', (ev) => {
        ev.preventDefault();

        if (!newCompanyName.value)
            return;

        fetch(`${ROOT || ''}/api/companies`, {
            method: "POST",
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: newCompanyName.value
            }),
        }).then(res => {
            return res.json();
        }).then(data => {
            newCompanyName.value = '';

            const option = document.createElement('option');
            option.value = data.id;
            option.innerText = data.name;
            option.selected = true;
            companiesSelect.appendChild(option);

            initMultiselect(companiesSelect);
            companiesSelect.dispatchEvent(new Event('change'));
        }).catch(err => {
            console.error(err);
        });
    });

    // Impacts
    const impactSelect = document.querySelector("#impact-select");
    const newImpactName = document.querySelector("#new-impact-name");
    const newImpactSubmit = document.querySelector("#new-impact-submit");

    newImpactSubmit.addEventListener('click', (ev) => {
        ev.preventDefault();

        if (!newImpactName.value)
            return;

        fetch(`${ROOT || ''}/api/impacts`, {
            method: "POST",
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: newImpactName.value
            }),
        }).then(res => {
            return res.json();
        }).then(data => {
            newImpactName.value = '';

            const option = document.createElement('option');
            option.value = data.id;
            option.innerText = data.name;
            option.selected = true;
            impactSelect.appendChild(option);

            initMultiselect(impactSelect);
            impactSelect.dispatchEvent(new Event('change'));
        }).catch(err => {
            console.error(err);
        });
    });

    // Communities
    const communitySelect = document.querySelector("#communities-select");
    const newCommunityName = document.querySelector("#new-community-name");
    const newCommunitySubmit = document.querySelector("#new-community-submit");

    newCommunitySubmit.addEventListener('click', (ev) => {
        ev.preventDefault();

        if (!newCommunityName.value)
            return;

        fetch(`${ROOT || ''}/api/communities`, {
            method: "POST",
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: newCommunityName.value
            }),
        }).then(res => {
            return res.json();
        }).then(data => {
            newCommunityName.value = '';

            const option = document.createElement('option');
            option.value = data.id;
            option.innerText = data.name;
            option.selected = true;
            communitySelect.appendChild(option);

            initMultiselect(communitySelect);
            communitySelect.dispatchEvent(new Event('change'));
        }).catch(err => {
            console.error(err);
        });
    });

    // Places
    const continentListSelect = document.querySelector('select[name="continent"]');
    const countryListSelect = document.querySelector('select[name="country"]');
    const regionListSelect = document.querySelector('select[name="region"]');

    initLocationList(continentListSelect, countryListSelect, regionListSelect);

    const continentFilter = document.querySelector('select[name="filter-continent"]');
    const countryFilter = document.querySelector('select[name="filter-country"]');
    const regionFilter = document.querySelector('select[name="filter-region"]');

    initLocationList(continentFilter, countryFilter, regionFilter);

    fetch(`${ROOT || ''}/api/places/continents`).then(res => {
        return res.json()
    }).then(data => {
        continentList = data;
        fillOptionList(continentFilter, data, false);
        fillOptionList(continentListSelect, data, false);
    });

    document.querySelector("#search-btn").addEventListener('click', ev => {
        ev.preventDefault();
        search();
    });
});
