const pluginRoot = require('requirefrom')('');
import { resolve, join, sep } from 'path';

export default function (kibana) {

    let APP_ROOT;
    let API_ROOT;
    let authenticationBackend;
    let searchGuardConfiguration;

    return new kibana.Plugin({
        id: 'authentication',
        publicDir: resolve(__dirname, 'public'),
        name: 'authentication',
        configPrefix: 'searchguard.authentication',

        config: function (Joi) {
            var obj = Joi.object({
                enabled: Joi.boolean().default(true),
                cookie: Joi.object().keys({
                    secure: Joi.boolean().default(false),
                    name: Joi.string().default('searchguard_authentication'),
                    password: Joi.string().min(32).default('searchguard_cookie_default_password'),
                    ttl: Joi.number().integer().min(1).default(60 * 60 * 1000),
                }).default(),
                session: Joi.object().keys({
                    ttl: Joi.number().integer().min(1).default(60 * 60 * 1000),
                    keepalive: Joi.boolean().default(true),
                }).default(),
                basicauth: Joi.object().keys({
                    enabled: Joi.boolean().default(true)
                }).default(),
                multitenancy: Joi.object().keys({
                    enabled: Joi.boolean().default(false)
                }).default()
            }).default();
            return obj;
        },

        uiExports: {
            hacks: [
                'plugins/authentication/chrome/logout_button',
                'plugins/authentication/services/access_control'
            ],
            apps: [{
                id: 'authentication',
                title: 'Login',
                main: 'plugins/authentication/apps/login',
                hidden: true,
                auth: false
            }],
            chromeNavControls: [
                'plugins/authentication/chrome/btn_logout/btn_logout.js'
            ]
        },

        init(server, options) {

            APP_ROOT = '/searchguard';
            API_ROOT = `${APP_ROOT}/api`;
            const config = server.config();
            console.log(config);
            if(config.get('searchguard.authentication.basicauth.enabled')) {
                server.register([
                    require('hapi-async-handler'),
                    require('hapi-auth-cookie'),
                    require('hapi-authorization')
                ], (error) => {

                    if (error) {
                        server.log(['error', 'searchguard'], `An error occurred registering server plugins: ${error}`);
                        this.status.red('An error occurred during initialisation, please check the logs.');
                        return;
                    }

                    this.status.yellow('Initialising Search Guard authentication plugin.');

                    if(config.get("searchguard.authentication.cookie.password") == 'searchguard_cookie_default_password') {
                        this.status.yellow("Default cookie password detected, please set a password in kibana.yml by setting 'searchguard.cookie.password' (min. 32 characters).");
                    }

                    if(!config.get("searchguard.authentication.cookie.secure")) {
                        this.status.yellow("'searchguard.cookie.secure' is set to false, cookies are transmitted over unsecure HTTP connection. Consider using HTTPS and set this key to 'true'");
                    }

                    // provides authentication methods against Search Guard
                    const BackendClass = pluginRoot(`lib/backend/searchguard`);
                    const authenticationBackend = new BackendClass(server, server.config);

                    // we use the cookie strategy
                    require('./lib/hapi/auth')(pluginRoot, server, APP_ROOT, API_ROOT);

                    // all your routes are belong to us
                    require('./lib/routes/routes')(pluginRoot, server, this, APP_ROOT, API_ROOT);

                    // make auth backend available
                    server.expose('getAuthenticationBackend', () => authenticationBackend);

                    this.status.yellow('Search Guard HTTP Basic Authentication enabled.');

                });

            } else {
                this.status.yellow('Search Guard HTTP Basic Authentication is disabled.');
            }

            this.status.green('Search Guard plugin initialised.');

        }

    });
};
