using CatalogService as service from '../../srv/read-from-s3';
annotate service.S3JsonData with @(
    UI.FieldGroup #GeneratedGroup : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Value : status,
                Criticality: statusCriticality,
                ![@UI.Hidden],
            },
            {
                $Type : 'UI.DataField',
                Value : to_Details.statusText,
                Criticality: statusCriticality,
            },
            {
                $Type : 'UI.DataField',
                Value : to_Details.processingTime,
                Label : 'Processing Time',
            },
            {
                $Type : 'UI.DataFieldForAnnotation',
                Target : '@UI.ConnectedFields#connected',
                Label : 'Error:',
                ![@UI.Hidden],
            },
        ],
    },
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'GeneratedFacet1',
            Target : '@UI.FieldGroup#GeneratedGroup',
            Label : 'Status',
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : 'Properties',
            ID : 'Properties',
            Target : '@UI.Identification',
        },
        {
            $Type : 'UI.ReferenceFacet',
            Label : 'Artifact Details',
            ID : 'Artifact',
            Target : '@UI.FieldGroup#Artifact',
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
            Label : 'iFlow Name',
            Value : iFlowName,
            ![@UI.Importance] : #High,
        },
        {
            $Type : 'UI.DataField',
            Label : 'Status',
            Value : status,
            Criticality : statusCriticality,
        },
        {
            $Type : 'UI.DataField',
            Value : date,
            Label : 'Date',
            ![@UI.Importance] : #Medium,
        },
        {
            $Type : 'UI.DataField',
            Value : filePath,
            Label : 'filePath',
            ![@UI.Hidden],
        },
    ],
    UI.SelectionFields: [
    date,
    status,
    subAccount,
    globalAccount,
    iFlowName,
],
    UI.Identification : [
        {
            $Type : 'UI.DataField',
            Value : messageGuid,
            Label : 'Message ID',
        },
        {
            $Type : 'UI.DataField',
            Value : to_Details.correlationID,
            Label : 'Correlation ID',
        },

    ],
    UI.FieldGroup #Artifact : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Value : to_Details.iFlowName,
                Label : 'Name',
            },
            {
                $Type : 'UI.DataField',
                Value : to_Details.iflowID,
                Label : 'ID',
            },
            {
                $Type : 'UI.DataField',
                Value : to_Details.type,
                Label : 'Type',
            },
            {
                $Type : 'UI.DataField',
                Value : to_Details.package,
                Label : 'Package',
            },
        ],
    },
    UI.HeaderInfo : {
        Title : {
            $Type : 'UI.DataField',
            Value : iFlowName,
        },
        TypeName : '',
        TypeNamePlural : '',
        Description : {
            $Type : 'UI.DataField',
            Value : date,
        },
    },
    UI.DeleteHidden : true,
    UI.ConnectedFields #connected : {
        $Type : 'UI.ConnectedFieldsType',
        Template : '{status} {to_Details_errorInfoMessage}',
        Data : {
            $Type : 'Core.Dictionary',
            status : {
                $Type : 'UI.DataField',
                Value : status,
            },
            to_Details_errorInfoMessage : {
                $Type : 'UI.DataField',
                Value : to_Details.errorInfoMessage,
            },
        },
    },
);

annotate service.S3JsonObject with {
    statusText @UI.MultiLineText : true
};

annotate service.S3JsonData with {
    date @Common.Label : 'Message Processing Date'
};

annotate service.S3JsonData with {
    status @(
        Common.Label : 'Status',
        Common.ValueList : {
            Label : '',
            CollectionPath : 'statusVH',
            Parameters : [
                {
                    $Type : 'Common.ValueListParameterInOut',
                    LocalDataProperty : status,
                    ValueListProperty : 'id',
                },
                {
                    $Type : 'Common.ValueListParameterDisplayOnly',
                    ValueListProperty : 'text',
                },
            ],
        },
        Common.ValueListWithFixedValues : true,
    )
};

annotate service.statusVH with {
    id @Common.Text : {
        $value : text,
        ![@UI.TextArrangement] : #TextOnly,
    }
};

annotate service.S3JsonData with {
    subAccount @(
        Common.Label : 'BTP Sub Account',
        Common.ValueList : {
            Label : '',
            CollectionPath : 'subAccountVH',
            Parameters : [
                {
                    $Type : 'Common.ValueListParameterIn',
                    LocalDataProperty : globalAccount,
                    ValueListProperty : 'globalAccount',
                },
                {
                    $Type : 'Common.ValueListParameterInOut',
                    LocalDataProperty : subAccount,
                    ValueListProperty : 'subAccount',
                },
            ],
        },
        Common.ValueListWithFixedValues : true,
    )
};

annotate service.S3JsonData with {
    globalAccount @(
        Common.Label : 'BTP Global Account',
        Common.ValueList : {
            Label : '',
            CollectionPath : 'globalAccountVH',
            Parameters : [
                {
                    $Type : 'Common.ValueListParameterInOut',
                    LocalDataProperty : globalAccount,
                    ValueListProperty : 'globalAccount',
                },
            ],
        },
        Common.ValueListWithFixedValues : true,
    )
};

annotate service.S3JsonData with {
    messageGuid @Common.Label : 'Message ID'
};

annotate service.S3JsonData with {
    iFlowName @Common.Label : 'iFlow Name'
};

annotate service.S3JsonObject with {
    errorInfoMessage @UI.MultiLineText : true
};

