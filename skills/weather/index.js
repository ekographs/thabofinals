const request = require('../../api/request');
const util = require('util');

const api_opnw = 'http://api.openweathermap.org/data/2.5/weather?units=metric&appid=%s&q=%s';
const api_opnw_in = 'http://api.openweathermap.org/data/2.5/weather?appid=%s&units=metric&q=%s';
const api_opnw_on = 'http://api.openweathermap.org/data/2.5/forecast?appid=%s&units=metric&q=%s';

async function setup() {
    if ((await global.db.getSkillValue('weather', 'openweathermap')) == null) {
        console.log('Setting default API key for Open Weather Map');
        await global.db.setSkillValue(
            'weather',
            'openweathermap',
            'f08bfa92a064d679ae0fad789a886f66',
        );
    }
}

const intent = () => ({
    keywords: [
        'what is the weather',
        'whats it like in qqqq',
        'temperature',
        'whats the weather qqqq',
    ],
    module: 'weather',
});

const examples = () => [
    "What's the weather like?",
    "What's it like in France?",
    "What's the temperature?",
];

function get_index_from_day() {
    const d = new Date();
    return d.getDay();
}

async function get_country() {
    let country_res = await request('https://ipinfo.io');
    country_res = JSON.parse(country_res.body);

    const loc_string = country_res.city + ',' + country_res.country;

    return loc_string.toLowerCase();
}

async function weatherResp(query) {
    let res;
    let country;
    let index;

    let forcast = false;
    let current_loc = await get_country();

    if (!current_loc || current_loc == '') {
        current_loc = 'dublin';
    }

    const key = await global.db.getSkillValue('weather', 'openweathermap');

    if (query.indexOf(' in ') != -1) {
        country = query.split(' in ')[1];

        if (country && country != '') {
            res = await request(util.format(api_opnw_in, key, country), {
                headers: {
                    'Content-type': 'application/json',
                },
            });
        } else {
            res = await request(util.format(api_opnw, key, current_loc), {
                headers: {
                    'Content-type': 'application/json',
                },
            });
        }
    } else if (query.indexOf(' for ') != -1 || query.indexOf(' on ') != -1) {
        country = query.split(' on ')[1];

        forcast = true;

        if (!country) {
            country = query.split(' for ')[1];
        }

        if (country.indexOf(' tomorrow') != -1) {
            index = get_index_from_day() + 1;
        } else {
            index = get_index_from_day(country);
        }

        res = await request(util.format(api_opnw_on, key, current_loc), {
            headers: {
                'Content-type': 'application/json',
            },
        });

        forcast = true;
    } else if (query.indexOf(' tomorrow') != -1) {
        index = get_index_from_day() + 1;
        forcast = true;
        res = await request(util.format(api_opnw_on, key, current_loc), {
            headers: {
                'Content-type': 'application/json',
            },
        });
    } else {
        res = await request(util.format(api_opnw, key, current_loc), {
            headers: {
                'Content-type': 'application/json',
            },
        });
    }

    res = JSON.parse(res.body);

    let weather_cond;
    let temp;
    let condition;
    let message;

    if (forcast) {
        weather_cond = res.list[index];
        temp = Math.floor(res.list[index].main.temp).toString() + '??';
        condition = weather_cond.weather[0].main;
    } else {
        weather_cond = res.weather[0];
        temp = Math.floor(res.main.temp).toString() + '??';
        condition = weather_cond.main;
    }

    if (condition == 'Clear') {
        message = 'It is currently <temp> and <condition>';
    } else {
        message = 'It is currently <temp> with <condition>';
    }

    if (forcast) {
        message = message.replace('It is currently', 'It will be');
    }

    let weather = message.replace('<temp>', temp);
    weather = weather.replace('<condition>', condition);

    if (country && country != '' && !forcast) {
        weather = weather + ' in ' + country;
    } else if (country && country != '' && forcast) {
        if (country.trim() != 'tomorrow') {
            weather = weather + ' on ' + country;
        }
    }

    if (query.indexOf('tomorrow') != -1 && weather.indexOf('tomorrow') == -1) {
        weather += ' tomorrow';
    }

    if (query.indexOf('temperature') != -1 && weather.indexOf('and') != -1) {
        const con_string = ' and ' + condition;
        weather = weather.replace(con_string, '');
    } else if (query.indexOf('temperature') != -1) {
        const con_string = ' with ' + condition;
        weather = weather.replace(con_string, '');
    }

    return { text: weather };
}

module.exports = {
    get: weatherResp,
    intent,
    examples,
    setup,
};
