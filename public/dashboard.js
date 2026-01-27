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

function closeModal() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('add-modal'));
    modal.hide();
}

function resetButton(text = "Add") {
    const submitButton = document.querySelector("#send-article");
    submitButton.disabled = false;
    submitButton.innerHTML = text;
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

function editArticle(articleId) {
    let articleData = articles[articleId];
    console.log(articleData);

    const articleForm = document.querySelector("#add-article");

    articleForm.querySelector("[name=id]").value = articleData.id;
    articleForm.querySelector("[name=title]").value = articleData.title;
    articleForm.querySelector("[name=url]").value = articleData.url;
    articleForm.querySelector("[name=date]").value = articleData.date;

    const types = articleForm.querySelector("[name=type]");
    setSelectOption(types, articleData.type, false, true);

    const sources = articleForm.querySelector("[name=source]");
    setSelectOption(sources, articleData.source, false);

    let companyIds = (articleData.companies || []).map(data => data.id);
    const companies = articleForm.querySelector("[name=companies]");
    setSelectOption(companies, companyIds, true);

    let impactIds = (articleData.impacts || []).map(data => data.id);
    const impacts = articleForm.querySelector("[name=impacts]");
    setSelectOption(impacts, impactIds, true);

    let communityIds = (articleData.communities || []).map(data => data.id);
    const communities = articleForm.querySelector("[name=communities]");
    setSelectOption(communities, communityIds, true);

    const perspectiveSelect = articleForm.querySelector("[name=perspective]");
    setSelectOption(perspectiveSelect, articleData.perspective, false, true);

    const { continent, country, region } = articleData;
    setPlaceSelect(continent, country, region);

    articleForm.querySelector("[name=notes]").value = articleData.notes || '';
    articleForm.querySelector("[name=approved]").checked = articleData.approved ? true : false;

    articleForm.querySelector("#send-article").innerText = "Update";
    articleForm.querySelector("#send-article").onclick = updateArticle;

    const deleteBtn = articleForm.querySelector("#delete-article");
    deleteBtn.classList.remove('invisible');

    deleteBtn.onclick = () => {
        const params = new URLSearchParams();
        params.append('id', articleData.id);

        fetch(`${ROOT || ''}/api/article?${params.toString()}`, {
            method: 'DELETE',
        }).then(_res => {
            closeModal();
            deleteRow(articleData.id);
        }).catch(error => {
            closeModal();

            const errorModal = new bootstrap.Modal('#message-modal');
            const errorBody = document.querySelector("#message-body");
            errorBody.innerText = error;
            errorModal.show();
        });


        const modal = bootstrap.Modal.getInstance(document.getElementById('add-modal'));
        modal.hide();
    };
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

async function updateArticle(ev) {
    console.log('updateArticle');
    ev.preventDefault();

    const formData = new FormData(document.querySelector("#add-article"));

    const submitButton = document.querySelector("#send-article");
    submitButton.disabled = true;
    submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span><span class="sr-only">Updating...</span>';

    try {
        await fetch(`${ROOT || ''}/api/article`, {
            method: "PUT",
            body: formData,
        }).then(res => {
            return res.json();
        }).then(newRow => {
            resetButton();
            closeModal();

            articles[newRow.id] = newRow;
            const rowEl = updateRow(newRow);
            rowEl.classList.add('table-warning');
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



function deleteRow(articleId) {
    const rows = document.querySelectorAll("#result-table tr");

    for (const row of rows) {
        if (row.querySelector("th").innerText == articleId) {
            row.remove();
            return;
        }
    }
}

function updateRow(item) {
    const rows = document.querySelectorAll("#result-table tr");

    for (const row of rows) {
        if (row.querySelector("th").innerText == item.id) {
            return addRow(item, row, fields);
        }
    }
}

window.addEventListener('DOMContentLoaded', function() {
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

    // Perspective
    const perspectivesSelect = document.querySelector("#article-perspective");


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

    let continentsPromise = fetch(`${ROOT || ''}/api/places/continents`).then(res => {
        return res.json()
    }).then(data => {
        continentList = data;
        fillOptionList(continentListSelect, data, false);
    });

    Promise.all([sourcesPromise, communitiesPromise, companiesPromise, impactsPromise, continentsPromise, perspectivesPromise]).then(() => {
        search();

        fillOptionList(sourceListSelect, sources, clear = false);
        fillOptionList(document.querySelector("#filter-source"), sources, clear = false);

        fillOptionList(companiesSelect, companies);
        initMultiselect(companiesSelect);

        fillOptionList(impactSelect, impacts);
        initMultiselect(impactSelect);

        fillOptionList(communitySelect, communities);
        initMultiselect(communitySelect);

        fillOptionList(perspectivesSelect, perspectives);
        fillOptionList(document.querySelector("#filter-perspective"), perspectives, clear = false);

        const companiesFilter = document.querySelector("#filter-companies");
        fillOptionList(companiesFilter, companies, clear = false);
        initMultiselect(companiesFilter, false);

        const impactsFilter = document.querySelector("#filter-impacts");
        fillOptionList(impactsFilter, impacts, clear = false);
        initMultiselect(impactsFilter, false);

        const communitiesFilter = document.querySelector("#filter-communities");
        fillOptionList(communitiesFilter, communities, clear = false);
        initMultiselect(communitiesFilter, false);
    });
});
