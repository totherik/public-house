import Url from 'url';
import Wreck from 'wreck';
import { Readable } from 'stream';


const INTERVAL = 30 * 1000;
const HOST = 'https://skimdb.npmjs.com:443';
const URL = {
    pathname: '/registry/_design/app/_view/updated',
    query: {
        include_docs: true,
        startkey: undefined
    }
};


export default class Couch extends Readable {

    constructor(host = HOST, interval = INTERVAL) {
        Readable.call(this, { objectMode: true });

        this.url = Object.assign(Url.parse(host), URL);
        this.interval = interval;
        this.startkey = new Date();
        this.lastUpdate = Date.now() - this.interval;
        this.visited = {};
        this.timer = null;
    }

    _read() {
        if (!this.timer) {
            let now = Date.now();
            let remaining = this.interval - (now - this.lastUpdate);

            this.timer = setTimeout(() => {
                this._update();
            }, Math.max(0, remaining));
        }
    }

    _update() {

        let resolve = rows => {
            if (rows.length) {

                // Regardless of whether we've seen this record before,
                // update the startkey with its key.
                this.startkey = rows[rows.length - 1].key;

                // Remove any already visited records and create a new
                // store of current records for the next update.
                let current = {};
                rows = rows.filter((row) => {
                    let { id, key: rev } = row;
                    let key = id + rev;

                    console.log(`(${id})`);
                    current[key] = 1;
                    return !(key in this.visited);
                });
                this.visited = current;

                if (rows.length) {
                    // Push rows that survived the filter pass.
                    for (let row of rows) {
                        this.push(row);
                    }
                } else {
                    // Nothing pushed, so no `_read` coming. Reset.
                    this._read();
                }

            } else {
                // Nothing pushed, so no `_read` coming. Reset.
                this._read();
            }
        };


        let reset = err => {
            if (err) {
                this.emit('error', err);
            }
            this._read();
        };


        this.url.query.startkey = JSON.stringify(this.startkey);

        Wreck.get(Url.format(this.url), { json: true }, (err, res, payload) => {
            // Reset timer so the next `_read` call kicks off the update.
            this.timer = null;
            this.lastUpdate = Date.now();

            if (err) {
                reset(err);
                return;
            }

            switch (res.statusCode) {
                case 200:
                    let { rows } = (typeof payload === 'string') ? JSON.parse(payload) : payload;
                    resolve(rows);
                    break;

                default:
                    err = new Error('Request error.' + payload);
                    err.code = res.statusCode;
                    reset(err);
                    break;
            }

        });
    }
}