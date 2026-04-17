// Vercel locations
const VERCEL_LOCATIONS = {
    "arn1": { "region": "eu-north-1", "city": "Stockholm", "country": "Sweden", "countryCode": "SE" },
    "bom1": { "region": "ap-south-1", "city": "Mumbai", "country": "India", "countryCode": "IN" },
    "cdg1": { "region": "eu-west-3", "city": "Paris", "country": "France", "countryCode": "FR" },
    "cle1": { "region": "us-east-2", "city": "Cleveland", "country": "USA", "countryCode": "US" },
    "cpt1": { "region": "af-south-1", "city": "Cape Town", "country": "South Africa", "countryCode": "ZA" },
    "dub1": { "region": "eu-west-1", "city": "Dublin", "country": "Ireland", "countryCode": "IE" },
    "dxb1": { "region": "me-central-1", "city": "Dubai", "country": "United Arab Emirates", "countryCode": "AE" },
    "fra1": { "region": "eu-central-1", "city": "Frankfurt", "country": "Germany", "countryCode": "DE" },
    "gru1": { "region": "sa-east-1", "city": "São Paulo", "country": "Brazil", "countryCode": "BR" },
    "hkg1": { "region": "ap-east-1", "city": "Hong Kong", "country": "Hong Kong", "countryCode": "HK" },
    "hnd1": { "region": "ap-northeast-1", "city": "Tokyo", "country": "Japan", "countryCode": "JP" },
    "iad1": { "region": "us-east-1", "city": "Washington, D.C.", "country": "USA", "countryCode": "US" },
    "icn1": { "region": "ap-northeast-2", "city": "Seoul", "country": "South Korea", "countryCode": "KR" },
    "kix1": { "region": "ap-northeast-3", "city": "Osaka", "country": "Japan", "countryCode": "JP" },
    "lhr1": { "region": "eu-west-2", "city": "London", "country": "United Kingdom", "countryCode": "GB" },
    "pdx1": { "region": "us-west-2", "city": "Portland", "country": "USA", "countryCode": "US" },
    "sfo1": { "region": "us-west-1", "city": "San Francisco", "country": "USA", "countryCode": "US" },
    "sin1": { "region": "ap-southeast-1", "city": "Singapore", "country": "Singapore", "countryCode": "SG" },
    "syd1": { "region": "ap-southeast-2", "city": "Sydney", "country": "Australia", "countryCode": "AU" },
    "yul1": { "region": "ca-central-1", "city": "Montréal", "country": "Canada", "countryCode": "CA" }
};

let countryCode;
if (network_data && !network_data.identified) {
    // Get possible geo-location
    const endpoint_network = `http://ip-api.com/json/${network_data.ip_start}?fields=3206911`;
    const location_clue = document.getElementById("ip-location-clue");
    fetch(endpoint_network)
        .then(res => {
            return res.json();
        }).then(ip_data => {
            console.log(ip_data);
            if (!ip_data || ip_data.status !== 'success') {
                location_clue.remove()
                return;
            }
            location_clue.innerHTML = `<a href="https://ip-api.com/#${network_data.ip_start}" target="_blank" rel="noopener noreferrer">ip-api.com</a> 
            suggests it is located in 
            <em>${ip_data.city}, ${ip_data.country}</em> (unlikely).`;
        }).catch(err => {
            location_clue.remove()
            console.log("error getting location clue");
            console.error(err);
        });

    const header_clue = document.getElementById("header-clue");
    if (network_data.clues) {
        const clues = JSON.parse(network_data.clues);
        //console.log(clues);
        if (!clues.length)
            header_clue.remove();
        else {
            for (const clue of clues) {
                console.log(clue);
                if (clue.type === 'Vercel') {
                    const vercel_location = VERCEL_LOCATIONS[clue.regionCode];
                    countryCode = vercel_location.countryCode;
                    header_clue.innerHTML = `A response from this ip range contained the header <span class="mono">${clue.header}</span> with the location code <b><span class="mono">${clue.regionCode}</span></b>, which is located in <b>${vercel_location.city}, ${vercel_location.country}</b> (very likely!)`;
                } else if (clue.type === "Cloudfare" || clue.type === "Amazon CloudFront") {
                    header_clue.innerHTML = `A response from this ip range contained the header <span class="mono">${clue.header}</span> which contained the airport code <b><span class="mono">${clue.IATACode}</span></b>. Check <a href="https://www.iata.org/en/publications/directories/code-search/" target="_blank" rel="noopener noreferrer">IATA.org</a> to search for which city this dataceter is located near.`;
                } else if (clue.type === "Akamai CDN") {
                    header_clue.innerHTML = `A response from this ip range contained the header <span class="mono">${clue.header}</span> which contained the location code <b><span class="mono">${clue.location}</span></b>.`;
                }
            }
        }
    }
    else
        header_clue.remove();


    if (network_data.asn) {
        if (!countryCode) {
            // Get user country
            const endpoint_user = `http://ip-api.com/json/`;
            fetch(endpoint_user).then(res => res.json()).then(user_data => {
                if (user_data && user_data.countryCode)
                    countryCode = user_data.countryCode;
                getFacilities();
            }).catch((err) => {
                console.log('Error getting countryCode');
                console.log(err);
                getFacilities();
            });
        } else {
            getFacilities();
        }

    }
}

let facilities = [];

async function getFacilities() {
    const clueList = document.getElementById("clues");
    const clue = document.getElementById("facility-clue");

    const search_params = new URLSearchParams();
    search_params.append('asn', network_data.asn);
    if (countryCode)
        search_params.append('country_code', countryCode);

    console.log(search_params);

    const net_info = await fetch(`${window.location.origin}/api/datacenter?${search_params.toString()}`).then(res => res.json()).catch(err => {
        console.error("Error getting net_info");
        console.error(err);
    });
    console.log(net_info);
    if (!net_info || net_info.length == 0) {
        clue.innerHTML = 'No disclosed facility info can be found for this network from <a href="https://www.peeringdb.com" target="_blank" rel="noopener noreferrer">PeeringDB</a>.';
        return;
    }

    clue.innerText = 'Based on facilities registered with this network and your approx location, it is likely one of the following facilities:';

    const facility_list = document.createElement("ul");
    const all_coords = [];
    for (const fac_info of net_info) {
        const fac_el = document.createElement("li");
        fac_el.innerHTML = `<a href="https://www.peeringdb.com/fac/${fac_info.id}" target="_blank" rel="noopener noreferrer"><em>${fac_info.name}</em></a> in ${fac_info.city}`;
        facility_list.appendChild(fac_el);

        const coords = [fac_info.latitude, fac_info.longitude];
        all_coords.push(coords);

        const marker = L.circleMarker(coords, {
            radius: 6,
            color: '#fff',
            weight: 2,
            fillColor: '#c85050',
            fillOpacity: 1,
        }).addTo(map).bindTooltip(fac_info.name);

        marker.on('click', () => {
            let google_url = `https://www.google.com/maps?q=${coords.join(',')}`;
            window.open(google_url, '_blank').focus();
        });
    }

    if (all_coords.length == 1)
        map.setView(all_coords[0], 15);
    else if (all_coords.length > 1)
        map.fitBounds(L.latLngBounds(all_coords), { padding: [40, 40] });

    clue.appendChild(facility_list);
    clueList.appendChild(clue);
}

const map = L.map('map', { zoomControl: false }).setView([52.37, 4.90], 13);

L.control.zoom({ position: 'bottomright' }).addTo(map);
// L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
L.tileLayer('http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
    attribution: '© CartoDB',
    maxZoom: 17
}).addTo(map);


