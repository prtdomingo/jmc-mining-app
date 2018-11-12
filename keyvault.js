require('dotenv').config();

var KeyVault = require('azure-keyvault');
var AuthenticationContext = require('adal-node').AuthenticationContext;
var clientId = process.env.CLIENT_ID;
var clientSecret = process.env.CLIENT_SECRET;
var vaultBaseUri = process.env.VAULT_URI;
var Promise = require('bluebird');

// Authenticator - retrieves the access token
var authenticator = function (challenge, callback) {
    // Create a new authentication context.
    var context = new AuthenticationContext(challenge.authorization);
    // Use the context to acquire an authentication token.
    return context.acquireTokenWithClientCredentials(challenge.resource, clientId, clientSecret, function (err, tokenResponse) {
        if (err) throw err;
        // Calculate the value to be set in the request's Authorization header and resume the call.
        var authorizationValue = tokenResponse.tokenType + ' ' + tokenResponse.accessToken;
        return callback(null, authorizationValue);
    });
};

var credentials = new KeyVault.KeyVaultCredentials(authenticator);
var client = new KeyVault.KeyVaultClient(credentials);

var getSecretValue = function(secretName) {
    return new Promise(function(resolve, reject) {
        client.getSecret(vaultBaseUri, secretName, '', function(err, result) {
            if(err) return reject(err);
            resolve(result.value);
        });
    });
}

var cosmosDbConnectionString = function() {
    return getSecretValue(process.env.COSMOSDB_SECRET_NAME);
}

var appInsightsKey = function() {
    return getSecretValue(process.env.APP_INSIGHTS_SECRET);
}

var redisCacheConnectionString = function() {
    return getSecretValue(process.env.REDIS_CACHE);
}

module.exports = {
    cosmosDbConnectionString: cosmosDbConnectionString,
    appInsightsKey: appInsightsKey,
    redisCacheConnectionString: redisCacheConnectionString
};