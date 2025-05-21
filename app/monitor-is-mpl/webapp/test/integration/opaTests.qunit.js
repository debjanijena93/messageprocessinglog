sap.ui.require(
    [
        'sap/fe/test/JourneyRunner',
        'monitorismpl/test/integration/FirstJourney',
		'monitorismpl/test/integration/pages/S3JsonDataList',
		'monitorismpl/test/integration/pages/S3JsonDataObjectPage'
    ],
    function(JourneyRunner, opaJourney, S3JsonDataList, S3JsonDataObjectPage) {
        'use strict';
        var JourneyRunner = new JourneyRunner({
            // start index.html in web folder
            launchUrl: sap.ui.require.toUrl('monitorismpl') + '/index.html'
        });

       
        JourneyRunner.run(
            {
                pages: { 
					onTheS3JsonDataList: S3JsonDataList,
					onTheS3JsonDataObjectPage: S3JsonDataObjectPage
                }
            },
            opaJourney.run
        );
    }
);