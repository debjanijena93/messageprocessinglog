sap.ui.define(['sap/fe/test/ListReport'], function(ListReport) {
    'use strict';

    var CustomPageDefinitions = {
        actions: {},
        assertions: {}
    };

    return new ListReport(
        {
            appId: 'monitorismpl',
            componentId: 'S3JsonDataList',
            contextPath: '/S3JsonData'
        },
        CustomPageDefinitions
    );
});