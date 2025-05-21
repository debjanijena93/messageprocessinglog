using CatalogService as service from '../../srv/read-from-s3';
annotate service.S3JsonData with @(
    UI.FieldGroup #GeneratedGroup : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Label : 'messageGuid',
                Value : messageGuid,
            },
            {
                $Type : 'UI.DataField',
                Label : 'globalAccount',
                Value : globalAccount,
            },
            {
                $Type : 'UI.DataField',
                Label : 'subAccount',
                Value : subAccount,
            },
            {
                $Type : 'UI.DataField',
                Label : 'iflowName',
                Value : iflowName,
            },
            {
                $Type : 'UI.DataField',
                Label : 'status',
                Value : status,
            },
            {
                $Type : 'UI.DataField',
                Label : 'statusCriticality',
                Value : statusCriticality,
            },
            {
                $Type : 'UI.DataField',
                Label : 'filePath',
                Value : filePath,
            },
            {
                $Type : 'UI.DataField',
                Label : 'date',
                Value : date,
            },
            {
                $Type : 'UI.DataField',
                Label : 'processingTime',
                Value : processingTime,
            },
        ],
    },
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'GeneratedFacet1',
            Label : 'General Information',
            Target : '@UI.FieldGroup#GeneratedGroup',
        },
    ],
    UI.LineItem : [
        {
            $Type : 'UI.DataField',
            Label : 'messageGuid',
            Value : messageGuid,
        },
        {
            $Type : 'UI.DataField',
            Label : 'globalAccount',
            Value : globalAccount,
        },
        {
            $Type : 'UI.DataField',
            Label : 'subAccount',
            Value : subAccount,
        },
        {
            $Type : 'UI.DataField',
            Label : 'iflowName',
            Value : iflowName,
        },
        {
            $Type : 'UI.DataField',
            Label : 'status',
            Value : status,
        },
    ],
);

