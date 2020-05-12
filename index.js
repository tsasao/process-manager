const program = require('commander');

program
    .option('-a, --auto-start', 'auto start')
    .option('-d, --dir <s>', 'apps directory [apps]')
    .option('-p, --port <n>', 'listen port')
    .option('-l, --line <n>', 'buffer size');

program.parse(process.argv);

const child_process = require('child_process');
require('date-utils');

const buffer_size = program.line || 1000;

const apps_dir = program.dir || './apps';

const processes = [ ];
const fs = require('fs');
fs.readdirSync(apps_dir).forEach(f => {
    try {
        const json = fs.readFileSync([ apps_dir, f, 'apps.json' ].join('/'));
        const apps = JSON.parse(json);
        // TODO: apps.lengthが2以上ある場合はname必須
        apps.forEach(app => {
            processes.push(Object.assign({ }, app, {
                name: app.name === undefined ? f : [ f, app.name ].join('-'),
                dir: [ apps_dir, f ].join('/'),
            }));
        });
    } catch(error) {
        console.log(error);
    }
});

const now = () => {
    return (new Date()).toFormat('YYYY-MM-DD HH24:MI:SS');
};

processes.forEach((p) => {
    p.log = [ ];
});

let terminating = false

const start = (p) => {
    if(p.process) {
        console.warn('already started');
        return;
    }
    const sp = child_process.spawn(p.command[0], p.command.slice(1), { cwd: p.dir });
    p.process = sp;
    const handler = (data) => {
        // FIXME: 行単位で来る保証はないので、stdout/stderrそれぞれでバッファリングして、
        // 改行が出てきたらlineとして切り出すようにしたい
        const line = now() + ' ' + data.toString().replace(/\n/, '');
        console.log(line);
        p.log.push(line);

        // 古いログを消す
        while(buffer_size < p.log.length) {
            p.log.unshift();
        }
    };
    sp.stdout.on('data', (data) => handler(data));
    sp.stderr.on('data', (data) => handler(data));
    sp.on('exit', (code, signal) => {
        console.log(p.name+' was terminated by code='+code);
        p.process = null;
        
        const running_processes = processes.filter(p => p.process).length;
        if(terminating && running_processes == 0) {
            console.log('no more processes, exiting...');
            process.exit();
        }
    });
};

const stop = function(p) {
    if(p.process) {
        p.process.kill();
    } else {
        console.log('already stopped.');
    }
};

if(program.autoStart) {
    const tasks = processes.map((p) => {
        return () => {
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    console.log('starting '+p.name+'...');
                    start(p);
                    resolve();
                }, 2000);
            });
        };
    });
    tasks
        .reduce(function(prev, curr) { return prev.then(curr); }, Promise.resolve())
        .then(() => {
            console.log('ok.');
        });
}

const authorized = (h) => {
    if(!process.env['BASIC_AUTH']) {
        return true;
    }
    if(!h) {
        return false;
    }
    const type_auth = h.split(/ /, 2);
    if(!type_auth[0].match(/^basic$/i)) {
        return false;
    }
    const decoded = (new Buffer(type_auth[1], 'base64')).toString();
    return process.env['BASIC_AUTH'] === decoded;
};

process.on('SIGTERM', function() {
    if(terminating) {
        console.log('caught SIGTERM in index.js (dup)')
        return;
    }
    
    console.log('caught SIGTERM in index.js')
    terminating = true
});

const startTime = new Date();
const http = require('http');
const port = parseInt(program.port) || 8080;
http.createServer((req, res) => {
    console.log(req.method + ' ' + req.url);
    
    if(!authorized(req.headers.authorization)) {
        res.writeHead(401, {'Content-Type': 'text/plain', 'WWW-Authenticate': 'Basic realm=id'});
        res.end('Authorization required');
        return;
    }

    const method_path = req.method + ' ' + req.url;
    var m;
    if(m = method_path.match(/^POST \/command\/(\d+)$/)) {
        const idx = parseInt(m[1]);
        const p = processes[idx-1];
        console.log('starting '+p.name);
        start(p);
        req.on('data', function (data) {
            console.log('data ready: '+data);
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end('{}');
        });
    } else if(m = method_path.match(/^DELETE \/command\/(\d+)$/)) {
        const idx = parseInt(m[1]);
        const p = processes[idx-1];
        console.log('killing '+p.name);
        stop(p);
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end('{}');
    } else if(method_path == 'GET /status') {
        res.writeHead(200, {'Content-Type': 'application/json'});
        const data = {
            processes: processes.map((p, idx) => {
                return { id: 1+idx,
                         status: p.process && p.process.pid ? 'RUNNING' : 'NONE',
                         name: p.name,
                         command: p.command.join(' '),
                         log: p.log
                       };
            }),
            age: Math.floor(((new Date()).getTime() - startTime.getTime())/1000),
        };
        res.end(JSON.stringify(data));
    } else if(method_path == 'GET /') {
        res.writeHead(200, {'Content-Type': 'text/html'});
        fs.readFile('index.html', (err, data) => {
            res.end(data);
        });
    } else {
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.end('Not found');
    }
})
.listen(port, () => {
    console.log('Server http://localhost:'+port);
});
