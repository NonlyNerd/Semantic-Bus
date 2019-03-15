'use strict';
class ValueFromPath {
  constructor () {
    this.dotProp = require('dot-prop')
  }

  progress (node, pathArray, pathObject, currentKey,counter) {
    // console.log('progress',counter,pathArray,currentKey);

    if(counter<100){
      pathArray = JSON.parse(JSON.stringify(pathArray))
      pathObject = JSON.parse(JSON.stringify(pathObject))
      // console.log('progress', pathArray,node, pathObject);

      let index = parseInt(pathArray[0])

      if (Array.isArray(node) && isNaN(index) && pathArray.length > 0) {

        let out = []
        node.forEach(r => {
          // console.log('r before', r);
          out.push(this.progress(r, pathArray, pathObject, currentKey,++counter))
          // console.log('r after', r);
        })
        // console.log('out',out);
        return out
      } else {
        if (pathArray.length == 0) {
          for (let pathObjectKey in pathObject) {
            console.log('isArray',Array.isArray(node));
            if (Array.isArray(node)){
              // TODO switch off decause persistence bug (frag.lib)
              // node.forEach(n=>{
              //     n[pathObjectKey] = pathObject[pathObjectKey]
              // })
            }else{
              node[pathObjectKey] = pathObject[pathObjectKey]
            }
          }
          return node
        } else {
          let key = pathArray.shift()
          for (let keyNode in node) {
            // console.log('copare',keyNode,key,keyNode.localeCompare(key));
            if (keyNode.localeCompare(key) != 0) {
              // console.log('ALLO');
              // let targetKey=currentKey==undefined?keyNode:targetKey+'-'+keyNode;
              pathObject[currentKey + '-' + keyNode] = node[keyNode]
            }
          }

          if (node.hasOwnProperty(key)) {
            return this.progress(node[key], pathArray, pathObject, key,++counter)
          } else {
            return undefined
          }
          // console.log('pathObject increment',pathObject);
        }
      }
    }else{
      return node
    }

  }

  resolve (source, specificData) {
    let matches = specificData.path.split('.')
    // console.log('matches',matches);
    let result = this.progress(source, matches, {}, 'root',0)
    //let result = source;
    // console.log('result',result);
    return (result)
  }

  pull (data, flowData) {
    return new Promise((resolve, reject) => {
      // console.log(flowData[0],data.specificData.path);
      // let value=this.dotProp.get(flowData[0].data, data.specificData.path)
      try{
        let value = this.resolve(flowData[0].data, data.specificData);
        console.log('RESOLVE');
        resolve({
          data: value
        })
      }catch (e){
        console.log('REJECT');
        reject(e);
      }

    })
  }
}

module.exports = new ValueFromPath()
