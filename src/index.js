import Through from 'through2';
import Couch from './couch';
import pkg from '../package.json';


let publish = function (server, options, next) {
    let source = new Couch();
    source.on('error', function (err) {
        server.log(['error', pkg.name], err);
    });

    source.pipe(Through.obj(function (data, _, done) {
        server.log(['info', pkg.name], data.id);
        done();
    }));

    next();
};

publish.attributes = {
    pkg: pkg
};

export default publish;