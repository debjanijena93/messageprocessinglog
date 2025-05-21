sap.ui.define(['sap/fe/test/ObjectPage'], function(ObjectPage) {
    'use strict';

    var CustomPageDefinitions = {
        actions: {},
        assertions: {}
    };

    return new ObjectPage(
        {
            appId: 'monitorismpl',
            componentId: 'S3JsonDataObjectPage',
            contextPath: '/S3JsonData'
        },
        CustomPageDefinitions
    );
});