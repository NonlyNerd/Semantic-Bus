'use strict';
class MongoConnector {
  constructor () {
    this.mongoose = require('mongoose')
    this.MongoClient = require('mongodb').MongoClient
    this.dotProp = require('dot-prop')
    this.schema = null
    this.modelShema = null
    this.stepNode = true
    this.PromiseOrchestrator = require('../../core/helpers/promiseOrchestrator.js')
    this.ArraySegmentator = require('../../core/helpers/ArraySegmentator.js')
  }

  mongoInitialise (url) {
    return new Promise((resolve, reject) => {
      if (url) {
          this.MongoClient.connect(url).then(client => {
            resolve(client)
          }).catch(e => {
            e.displayMessage = 'connection to MongoDB database failed'
            console.error('MongoDB Error',e);
            reject(e)
          })

      } else {
        const fullError = new Error('bad uri mongo connector')
        fullError.displayMessage = 'Connecteur Mongo : Veuillez entre une uri de connexion valide';
        reject(fullError)
      }
    })
  }

  mongoRequest (client, querysTable, database, collectionName, queryParams) {
    return new Promise((resolve, reject) => {
      try {
        const db = client.db(database)
        // console.log(db);
        const collection = db.collection(collectionName)
        const normalizedQuerysTable = this.normalizeQuerysTable(querysTable, queryParams)
        // console.log(normalizedQuerysTable);
        const evaluation = eval('collection.' + normalizedQuerysTable)
        let mongoPromise
        if (evaluation instanceof Promise) {
          mongoPromise = evaluation
        } else {
          mongoPromise = evaluation.toArray()
        }

        mongoPromise.then(result => {
          resolve({
            result: result,
            client: client
          })
        })
      } catch (e) {
        reject(e)
      }
    })
  }

  mongoClose (client) {
    return new Promise((resolve, reject) => {
      return client.close()
    })
  }

  initialise (url) {
    return new Promise(function (resolve, reject) {
      if (url) {
        resolve(url)
      } else {
        let fullError = new Error('bad uri mongo connector')
        fullError.displayMessage = 'Connecteur Mongo : Veuillez entre une uri de connexion valide';
        reject(fullError)
      }
    })
  }

  createmodel (modelName, data, url) {
    return new Promise(function (resolve, reject) {
      const db = this.mongoose.createConnection(url, (error) => {
        if (error) {
          let fullError = new Error(error)
          fullError.displayMessage = 'Connecteur Mongo : Veuillez entre une uri de connexion valide';
          reject(fullError)
        } else {
          const modelShema = db.model(modelName, new this.mongoose.Schema({}, {
            strict: false
          }), modelName)
          if (modelName != null) {
            resolve({
              db: db,
              model: modelShema
            })
          } else {
            let fullError = new Error("vous n'avez pas saisie de nom de table à requeter")
            fullError.displayMessage = "Connecteur Mongo : vous n'avez pas saisie de nom de table à requeter "
            reject(fullError)
          }
        }
      })
    }.bind(this))
  }

  request (querysTable, modelShema, queryParams) {
    // console.log('REQUEST', queryParams);
    if (querysTable == null || querysTable.length == 0) {
      return modelShema.model
        .find()
        .lean()
        .exec()
        .catch(error => {
          let fullError = new Error(error)
          fullError.displayMessage = 'Connecteur Mongo :  nous avons rencontré un probleme avec MongoDB';
          throw fullError
        })
    } else {
      try {
        const normalizedQuerysTable = this.normalizeQuerysTable(querysTable, queryParams)
        return eval('modelShema.model.' + normalizedQuerysTable + '.lean()')
          .exec()
          .then(data => data || [])
          .catch(error => {
            let fullError = new Error(error)
            fullError.displayMessage = 'Connecteur Mongo :  nous avons rencontré un probleme avec votre query MongoDB';
            throw fullError
          })
      } catch (e) {
        if (e instanceof SyntaxError) {
          let fullError = new Error(e)
          fullError.displayMessage = "Connecteur Mongo : Veuillez entre une query valide  ex: findOne({name:'thomas')}"
          return Promise.reject(fullError)
        } else {
          return Promise.reject(e)
        }
      }
    }
  }

  normalizeQuerysTable (querysTable, queryParams) {
    let processingQuerysTable = querysTable
    const regex = /{(\£.*?)}/g
    const elementsRaw = processingQuerysTable.match(regex)
    if (elementsRaw != null) {
      for (let match of elementsRaw) {
        const ObjectKey = match.slice(3, -1)

        processingQuerysTable = processingQuerysTable.replace(match, JSON.stringify(this.dotProp.get(queryParams, ObjectKey)))
      }
      // console.log(processingQuerysTable);
    }
    return processingQuerysTable
  }

  insert (dataFlow, modelShema) {

    return modelShema.model
      .remove({})
      .exec()
      .then(() => {
        const arraySegmentator = new this.ArraySegmentator()
        const segments = arraySegmentator.segment(dataFlow, 100)
        const paramArray = segments.map(s => [modelShema, s])
        const promiseOrchestrator = new this.PromiseOrchestrator()
        promiseOrchestrator.execute(this, this.insertPromise, paramArray, {
          beamNb: 10
        })
      })
  }

  mongoInsert (client, database, collectionName, dataFlow) {
    // console.log('mongoInsert');
    return new Promise((resolve, reject) => {
      try {
        const db = client.db(database)

        // console.log('db',db);
        const collection = db.collection(collectionName)
        collection.remove({}).then(() => {
          // console.log('mongoInsert : records removed');
          const arraySegmentator = new this.ArraySegmentator()
          let segmentFlow;
          // console.log('dataFlow',dataFlow);
          if(!Array.isArray(dataFlow)){
            segmentFlow=[dataFlow];
          }else{
            segmentFlow=dataFlow;
          }
          const segments = arraySegmentator.segment(segmentFlow, 100)

          const paramArray = segments.map(s => [collection, s])
          const promiseOrchestrator = new this.PromiseOrchestrator()
          promiseOrchestrator.execute(this, this.mongoInsertPromise, paramArray, {
            beamNb: 10
          }).then(() => {
            // console.log('mongoInsert : records inserted');
            resolve()
          })
        })
      } catch (e) {
        reject(e)
      } finally {
        // client.close();
      }
    })
  }

  mongoInsertPromise (collection, data) {
    // console.log("mongoInsertPromise",collection,data.length);
    console.log('data',data[0]);
    console.log('data newStart',data[0].newStart);
    console.log('data Date',data[0].newStart instanceof Date);
    console.log('data String',data[0].newStart instanceof String);
    console.log('data typeof',typeof data[0].newStart);
    return collection.insertMany(data)
  }

  insertPromise (modelShema, data) {
    return modelShema.model.insertMany(data).exec()
  }

  pull (data, dataFlow, queryParams) {

    if (dataFlow === undefined) {
      return new Promise(async (resolve, reject) => {
        let client;
        try {
          client = await this.mongoInitialise(data.specificData.url)
          const mongoRequestResolved = await this.mongoRequest(client, data.specificData.querySelect, data.specificData.database, data.specificData.modelName, queryParams)
          resolve({
            data: mongoRequestResolved.result
          })
        } catch (error) {
          reject(error)
        } finally {
          client.close()
        }
      })
    } else {
      console.log('dataFlow',dataFlow[0].data[0]);
      console.log('dataFlow newStart',dataFlow[0].data[0].newStart);
      console.log('dataFlow Date',dataFlow[0].data[0].newStart instanceof Date);
      console.log('dataFlow String',dataFlow[0].data[0].newStart instanceof String);
      console.log('dataFlow typeof',typeof dataFlow[0].data[0].newStart);
      return new Promise(async (resolve, reject) => {
        let client
        try {
          client = await this.mongoInitialise(data.specificData.url)
          await this.mongoInsert(client, data.specificData.database, data.specificData.modelName, dataFlow[0].data)
          resolve({ data: dataFlow[0].data })
        } catch (error) {
          reject(error)
        } finally {
          client.close()
        }
      })
    }
  }
}

module.exports = new MongoConnector()
