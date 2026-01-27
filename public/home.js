window.addEventListener('DOMContentLoaded', function() {
    // Get sources 
    Promise.all([sourcesPromise, communitiesPromise, companiesPromise, impactsPromise, perspectivesPromise]).then(() => {
        fetchItems();

        fillOptionList(document.querySelector("#filter-source"), sources, clear = false);
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

