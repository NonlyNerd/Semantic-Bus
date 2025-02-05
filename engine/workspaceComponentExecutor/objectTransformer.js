'use strict'
class ObjectTransformer {
  constructor () {
    this.objectTransformation = require('../utils/objectTransformation.js')
  }

  initComponent (entity) {
    // console.log('Object Transformer | initComponent : ',entity);

    if (entity.specificData.transformObject == undefined) {
      entity.specificData.transformObject = {}
    }
    return entity
  }

  jsonTransform (source, jsonTransformPattern, pullParams) {
    let out =  this.objectTransformation.executeWithParams(source, pullParams, jsonTransformPattern)
    return out;
  }

  pull (data, flowData, pullParams) {
    return new Promise((resolve, reject) => {
      if (flowData != undefined) {
        resolve({
          data: this.jsonTransform(flowData[0].data, data.specificData.transformObject, pullParams)
        })
      } else {
        resolve({
          data: this.jsonTransform({}, data.specificData.transformObject, pullParams)
        })
      }
    })
  }
}
module.exports = new ObjectTransformer()
