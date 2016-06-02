var Logger = require('./logger');
var path = require('path');
var counterLog = new Logger.Logger(path.resolve(__dirname, '..', 'counters.log'));
import os from 'os';
import io from 'socket.io';
import Socket from 'socket.io/lib/socket';
import { RedisClient } from 'cytube-common/node_modules/redis/index';
import * as Metrics from 'cytube-common/lib/metrics/metrics';
import { JSONFileMetricsReporter } from 'cytube-common/lib/metrics/jsonfilemetricsreporter';

var counters = {};
var server = null;

exports.add = Metrics.incCounter;

Socket.prototype._packet = Socket.prototype.packet;
Socket.prototype.packet = function () {
    this._packet.apply(this, arguments);
    exports.add('socket.io:packet');
};

RedisClient.prototype._send_command = RedisClient.prototype.send_command;
RedisClient.prototype.send_command = function () {
    this._send_command.apply(this, arguments);
    exports.add('redis:send_command');
};

function getConnectedSockets() {
    var sockets = io.instance.sockets.sockets;
    if (typeof sockets.length === 'number') {
        return sockets.length;
    } else {
        return Object.keys(sockets).length;
    }
}

function setChannelCounts(metrics) {
    if (server === null) {
        server = require('./server').getServer();
    }

    try {
        var publicCount = 0;
        var allCount = 0;
        server.channels.forEach(function (c) {
            allCount++;
            if (c.modules.options && c.modules.options.get("show_public")) {
                publicCount++;
            }
        });

        metrics.addProperty('channelCount:all', allCount);
        metrics.addProperty('channelCount:public', publicCount);
    } catch (error) {
        Logger.errlog.log(error.stack);
    }
}

const reporter = new JSONFileMetricsReporter('counters.log');
Metrics.setReporter(reporter);
Metrics.setReportInterval(60000);
Metrics.addReportHook((metrics) => {
    metrics.addProperty('socket.io:count', getConnectedSockets());
    setChannelCounts(metrics);
});
