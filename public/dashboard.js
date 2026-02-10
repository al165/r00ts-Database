
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

async function sendCSV() {
    const formData = new FormData(document.querySelector("#add-csv"));
    const submitButton = this.document.querySelector("#send-csv");
    submitButton.disabled = true;
    submitButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span><span class="sr-only">Submitting...</span>';

    try {
        await fetch(`${ROOT || ''}/api/csv`, {
            method: "POST",
            body: formData,
        }).then(res => {
            return res.json();
        }).then(messages => {
            if (messages.error) {
                throw new Error(messages.error);
            }

            resetButton('Upload', 'send-csv');
            closeModal('csv-modal');

            const errorModal = new bootstrap.Modal('#message-modal');
            const errorBody = document.querySelector("#message-body");
            for (const msg of messages) {
                const m = document.createElement('p');
                m.innerText = msg;
                errorBody.appendChild(m);
            }
            errorModal.show();

        }).catch(err => {
            resetButton('Upload', 'send-csv');
            closeModal('csv-modal');

            const errorModal = new bootstrap.Modal('#message-modal');
            const errorBody = document.querySelector("#message-body");
            errorBody.innerText = err;
            errorModal.show();
        });
    } catch (error) {
        resetButton('Upload', 'send-csv');
        closeModal('csv-modal');

        const errorModal = new bootstrap.Modal('#message-modal');
        const errorBody = document.querySelector("#message-body");
        errorBody.innerText = err;
        errorModal.show();
    }
}

window.addEventListener('DOMContentLoaded', function() {

    this.document.querySelector("#send-csv").addEventListener('click', async (ev) => {
        ev.preventDefault();

        const result = await sendCSV();
    });

    Promise.all([sourcesPromise, communitiesPromise, companiesPromise, impactsPromise, perspectivesPromise]).then(() => {
        search();

        const sourceListSelect = document.querySelector("#article-source");
        const companiesSelect = document.querySelector("#companies-select");
        const impactSelect = document.querySelector("#impact-select");
        const communitySelect = document.querySelector("#communities-select");
        const perspectivesSelect = document.querySelector("#article-perspective");

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
