window.addEventListener('DOMContentLoaded', function() {
    // Get sources 
    Promise.all([sourcesPromise, communitiesPromise, companiesPromise, impactsPromise, perspectivesPromise]).then(() => {
        fetchItems();

        const sourceListSelect = document.querySelector("#article-source");
        fillOptionList(sourceListSelect, sources, clear = false);

        fillOptionList(document.querySelector("#filter-source"), sources, clear = false);
        fillOptionList(document.querySelector("#filter-perspective"), perspectives, clear = false);

        const companiesSelect = document.querySelector("#companies-select");
        const impactSelect = document.querySelector("#impact-select");
        const communitySelect = document.querySelector("#communities-select");
        const perspectivesSelect = document.querySelector("#article-perspective");
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

