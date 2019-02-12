function WorkspaceStore(utilStore, stompClient, specificStoreList) {


  // --------------------------------------------------------------------------------
  // --------------------------------------------------------------------------------
  // --------------------------------------------------------------------------------


  riot.observable(this);
  for (specificStore of specificStoreList) {
    specificStore.genericStore = this;
  }


  this.globalWorkspaceCollection;
  this.workspaceCollection;
  this.workspaceShareCollection;
  this.workspaceCurrent;
  this.workspaceBusiness = new WorkspaceBusiness();
  this.componentSelectedToAdd = [];
  //this.cancelRequire = false;
  this.modeConnectBefore = false;
  this.modeConnectAfter = false;
  this.utilStore = utilStore;
  this.stompClient = stompClient;
  this.processCollection = [];
  this.currentProcess = undefined;

  this.itemCurrent;
  this.connectMode;
  this.modeConnectBefore = false;
  this.modeConnectAfter = false;



  // --------------------------------------------------------------------------------
  // --------------------------------------------------------------------------------
  // --------------------------------------------------------------------------------


  // ----------------------------------------- FUNCTION  -----------------------------------------

  // Navigation and workspace initializer

  this.on('navigation', function (entity, id, action, secondId, secondAction) {
    if (entity === 'workspace') {
      if (id === 'new') {
        this.initializeNewWorkspace(entity, action)
        this.trigger('navigation_control_done', entity, action);
      } else if (this.workspaceCurrent !== undefined && this.workspaceCurrent._id === id) {
        this.reloadWorkspace(entity, action)
        if (action === 'component' && secondId !== undefined) {
          this.loadComponentPart(secondId, secondAction)
          this.trigger('navigation_control_done', 'component');
        } else {
          this.trigger('navigation_control_done', entity, action);
        }
      } else {
        this.unsubscribeToPreviousSubscription()
        this.select({ _id: id }).then(() => {
          this.subscribeToComponents(entity, action)
          if (action === 'component' && secondId !== undefined) {
            this.loadComponentPart(secondId, secondAction)
            this.trigger('navigation_control_done', 'component');
          } else {
            this.trigger('navigation_control_done', entity, action);
          }
        });
        this.loadProcesses(id);
      }
    }
  });

  this.initializeNewWorkspace = function (entity, action) {
    this.workspaceCurrent = {
      name: "",
      description: "",
      components: [],
      users: [],
      links: []
    };
    this.action = action;
    this.workspaceCurrent.mode = 'init';
  }

  this.reloadWorkspace = function (entity, action) {
    this.action = action;
    this.trigger('workspace_current_process_changed', this.processCollection);
  }

  this.unsubscribeToPreviousSubscription = function () {
    [
      this.subscription_workspace_current_move_component,
      this.subscription_workspace_current_updateComponentField,
      this.subscription_workspace_current_process_start,
      this.subscription_workspace_current_process_end,
      this.subscription_workspace_current_process_error,
      this.subscription_workspace_current_process_progress,
      this.subscription_workspace_current_process_persist,
      this.subscription_workflow_processCleaned
    ].forEach(component => {
      if (component !== undefined && component !== null && typeof component.unsubscribe === 'function') {
        component.unsubscribe()
      }
    })
  }

  this.subscribeToComponents = function (entity, action) {
    this.action = action;
    this.subscription_workspace_current_move_component = this.stompClient.subscribe('/topic/workspace_current_move_component.' + this.workspaceCurrent._id, message => {
      //console.log('message', JSON.parse(message.body));
      let body = JSON.parse(message.body);
      if (body.token !== localStorage.token) {
        let componentToUpdate = sift({
          _id: body.componentId
        }, this.workspaceCurrent.components)[0];
        componentToUpdate.graphPositionX = body.x;
        componentToUpdate.graphPositionY = body.y;
        this.computeGraph();
      }
    });
    this.subscription_workspace_current_updateComponentField = this.stompClient.subscribe('/topic/workspace_current_updateComponentField.' + this.workspaceCurrent._id, message => {
      console.log('message', JSON.parse(message.body));
      let body = JSON.parse(message.body);
      if (body.token !== localStorage.token) {
        //console.log('body',body);
        let updatingComponent = sift({
          _id: body.componentId
        }, this.workspaceCurrent.components)[0];
        utilStore.objectSetFieldValue(updatingComponent, body.field, body.data);
        //this.itemCurrent.specificData[body.field] = body.data;
        //console.log('this.itemCurrent',this.itemCurrent);
        if (this.itemCurrent._id === updatingComponent._id) {
          this.trigger('item_current_changed', updatingComponent);
        }
      }
    });
    this.subscription_workspace_current_process_start = this.stompClient.subscribe('/topic/process-start.' + this.workspaceCurrent._id, message => {
      console.log('subscription_workspace_current_process_start', JSON.parse(message.body));
      let body = JSON.parse(message.body);
      if (body.error === undefined) {
        let process = {
          _id: body._id,
          status: 'processing',
          steps: body.steps,
          timeStamp: body.timeStamp,
          stepFinished: 0
        }
        this.processCollection.unshift(process);
        if (body.callerId === localStorage.user_id) {
          //console.log('IT IS ME');
          this.currentProcess = process;
          this.computeGraph();
        }
        this.trigger('workspace_current_process_changed', this.processCollection);
      } else {
        this.trigger('ajax_fail', body.error);
      }
    });
    this.subscription_workspace_current_process_end = this.stompClient.subscribe('/topic/process-end.' + this.workspaceCurrent._id, message => {
      //console.log('message', JSON.parse(message.body));
      let body = JSON.parse(message.body);
      if (body.error === undefined) {
        let targetProcess = sift({
          _id: body._id
        }, this.processCollection)[0];
        console.log(targetProcess);
        if (targetProcess !== undefined) {
          targetProcess.status = 'resolved';
          this.trigger('workspace_current_process_changed', this.processCollection);
        }
      } else {
        this.trigger('ajax_fail', body.error);
      }
    });
    this.subscription_workspace_current_process_error = this.stompClient.subscribe('/topic/process-error.' + this.workspaceCurrent._id, message => {
      //console.log('message', JSON.parse(message.body));
      let body = JSON.parse(message.body);
      if (body.error === undefined) {
        let targetProcess = sift({
          _id: body._id
        }, this.processCollection)[0];
        if (targetProcess !== undefined) {
          targetProcess.status = 'error';
          this.trigger('workspace_current_process_changed', this.processCollection);
        }
      } else {
        this.trigger('ajax_fail', body.error);
      }
    });
    this.subscription_workspace_current_process_progress = this.stompClient.subscribe('/topic/process-progress.' + this.workspaceCurrent._id, message => {
      //console.log('message', JSON.parse(message.body));

      let body = JSON.parse(message.body);

      // if (body.error == undefined) {
      let targetProcess = sift({
        _id: body.processId
      }, this.processCollection)[0];

      if (targetProcess !== undefined) {
        //console.log('process Finded');
        let targetStep = sift({
          componentId: body.componentId
        }, targetProcess.steps)[0];
        if (targetStep !== undefined) {
          //console.log('step Finded');
          if (body.error === undefined) {
            targetStep.status = 'resolved';
          } else {
            targetStep.status = 'error';
            //  targetProcess.status = 'error';
          }
        }
        targetProcess.stepFinished = sift({
          status: {
            '$ne': 'waiting'
          }
        }, targetProcess.steps).length
        this.trigger('workspace_current_process_changed', this.processCollection);
        //console.log('ALLO',this.currentProcessId,body.processId);
        if (this.currentProcess && this.currentProcess._id === body.processId) {
          //console.log('ALLO2');
          this.computeGraph();
        }
      }
      //console.log(this.processCollection);
      // } else {
      //   this.trigger('ajax_fail', body.error);
      // }
    });
    this.subscription_workflow_processCleaned = this.stompClient.subscribe('/topic/workflow-processCleaned.' + this.workspaceCurrent._id, message => {
      let body = JSON.parse(message.body);
      this.processCollection = sift({
          _id: {
            $in: body.cleanedProcesses.map(p => p._id)
          }
        },
        this.processCollection
      );
      this.trigger('workspace_current_process_changed', this.processCollection);
    });
    this.subscription_workspace_current_process_persist = this.stompClient.subscribe('/topic/process-persist.' + this.workspaceCurrent._id, message => {
      console.log('message', JSON.parse(message.body));
      let body = JSON.parse(message.body);
      console.log(this.currentProcess._id, body.processId, this.itemCurrent._id, body.componentId);
      if (this.currentProcess._id === body.processId && this.itemCurrent._id === body.componentId) {
        this.trigger('item_current_process_persist_changed', body.data);
      }
    });
  }

  this.loadProcesses = function (id) {
    this.utilStore.ajaxCall({
      method: 'get',
      url: '../data/core/processByWorkflow/' + id
    }, true)
      .then(data => {
        this.processCollection = data;

        this.processCollection.forEach(process => {
          let waitingNB = sift({
            status: 'waiting'
          }, process.steps).length;
          let errorNB = sift({
            status: 'error'
          }, process.steps).length;
          if (errorNB > 0) {
            process.status = 'error';
          } else {
            if (waitingNB > 0) {
              process.status = 'waiting';
            } else {
              process.status = 'resolved';
            }
          }
          process.stepFinished = process.steps.length - waitingNB;
        });

        this.trigger('workspace_current_process_changed', this.processCollection);
      });
  }

  this.loadComponentPart = function (id, action) {
    this.action = action
    if (this.workspaceCurrent !== undefined) {
      this.itemCurrent = sift({ _id: id }, this.workspaceCurrent.components)[0];
      if (this.itemCurrent === undefined) {
        this.trigger('ajax_fail', 'no component existing with this id un current workspace');
      }
    } else {
      this.trigger('ajax_fail', 'the component can not be loaded without first loading its workspace');
    }
  }

  this.load = function() {
    //console.log('load workspace to ||', localStorage.user_id);
    return new Promise((resolve, reject) => {
      this.utilStore.ajaxCall({
        method: 'get',
        url: '../data/core/workspaceByUser/' + localStorage.user_id
      }, true).then(data => {
        console.log('load workspace', data);
        this.workspaceCollection = data;
        resolve(this.workspaceCollection);
      }).catch(error => {
        reject(error);
      });
    })
  }; //<= load_workspace

  // --------------------------------------------------------------------------------

  this.loadShareWorkspace = function() {
    console.log('load share workspace');

    return new Promise((resolve, reject) => {
      this.utilStore.ajaxCall({
        method: 'get',
        url: '../data/core/workspaces/share/' + localStorage.user_id,
      }, true).then(data => {
        //console.log('load workspace', data);
        this.workspaceShareCollection = data;
        resolve(this.workspaceShareCollection);
      }).catch(error => {
        reject(error);
      });
    })
  }; //<= load_share_workspace

  // --------------------------------------------------------------------------------
  //TODO passer par le proxy client
  this.create = function() {
    console.log('create');

    return new Promise((resolve, reject) => {
      this.utilStore.ajaxCall({
        method: 'post',
        url: '../data/core/workspace/' + localStorage.user_id,
        data: JSON.stringify(this.workspaceCurrent),
      }, true).then(data => {
        this.globalWorkspaceCollection.push({
          role: 'owner',
          workspace: data
        });
        this.setGlobalWorkspaceCollection(this.globalWorkspaceCollection);
        //this.workspaceBusiness.connectWorkspaceComponent(data.components);
        this.workspaceCurrent = data;
        this.workspaceCurrent.mode = 'edit';
        resolve(this.workspaceCurrent);
      }).catch(error => {
        reject(error);
      });
    });
  }; //<= create

  // --------------------------------------------------------------------------------
  //TODO passer par le proxy client
  this.update = function(data) {
    //console.log("data update", data)
    return new Promise((resolve, reject) => {
      var ajax_data = JSON.stringify(this.workspaceBusiness.serialiseWorkspace(this.workspaceCurrent))
      //console.log('ajax_data',ajax_data);
      this.trigger('persist_start');
      $.ajax({
        method: 'put',
        url: '../data/core/workspace',
        data: ajax_data,
        contentType: 'application/json',
        headers: {
          "Authorization": "JTW" + " " + localStorage.token
        },
      }).done(function(data) {
        this.trigger('persist_end', data);
        data.mode = 'edit';
        //this.workspaceBusiness.connectWorkspaceComponent(data.components);
        this.workspaceCurrent = data;
        //console.log('update data ||', data);
        this.trigger('workspace_current_persist_done', this.workspaceCurrent);
        this.trigger('workspace_current_changed', this.workspaceCurrent);
        if (this.viewBox) {
          this.computeGraph();
        }
        resolve(data);
      }.bind(this));
    })
  }; //<= update

  this.updateList = function(data) {
    console.log("data update", data)
    return new Promise((resolve, reject) => {
      var ajax_data = JSON.stringify(data)
      $.ajax({
        method: 'put',
        url: '../data/core/workspacerowId',
        data: ajax_data,
        contentType: 'application/json',
        headers: {
          "Authorization": "JTW" + " " + localStorage.token
        },
      }).done(function(data) {
        console.log("update done", data)
      }.bind(this));
    })
  }; //<= updateList

  // --------------------------------------------------------------------------------

  this.delete = function(record) {
    this.trigger('persist_start');
    $.ajax({
      method: 'delete',
      url: '../data/core/workspace/' + record._id + '/' + localStorage.user_id,
      contentType: 'application/json',
      headers: {
        "Authorization": "JTW" + " " + localStorage.token
      },
    }).done(function(data) {
      this.globalWorkspaceCollection = sift({
        'workspace._id': {
          $ne: record._id
        }
      }, this.globalWorkspaceCollection);
      this.setGlobalWorkspaceCollection(this.globalWorkspaceCollection);
      this.trigger('persist_end', data);
      this.trigger('workspace_collection_changed', this.workspaceCollection);
    }.bind(this));
  }; //<= delete

  // --------------------------------------------------------------------------------

  this.updateUserListe = function(data) {
    console.log('updateUserListe', data);
    $.ajax({
      method: 'get',
      url: '../data/core/workspaces/' + data._id + '/user/' + localStorage.user_id,
      headers: {
        "Authorization": "JTW" + " " + localStorage.token
      },
      contentType: 'application/json'
    }).done(function(data) {
      console.log('updateUserListeDone', data);
      if (data != false) {
        this.trigger('all_profil_by_workspace_loaded', data)
      } else {
        this.trigger('no_profil')
      }

    }.bind(this));
  }; // <= updateUserListe


  // --------------------------------------------------------------------------------

  this.on('load_workspace_graph', function(data) {
    // console.log(localStorage.user_id);
    $.ajax({
      method: 'get',
      url: '../data/core/workspace/' + data._id + '/graph',
      headers: {
        "Authorization": "JTW" + " " + localStorage.token
      },
      contentType: 'application/json'
    }).done(function(data) {
      this.trigger('graph_workspace_data_loaded', data)
    }.bind(this))
  })

  // --------------------------------------------------------------------------------

  this.select = function(record) {

    return new Promise((resolve, reject) => {
      this.utilStore.ajaxCall({
        method: 'get',
        url: '../data/core/workspace/' + record._id
      }, true).then(data => {
        //console.log(data);
        //this.workspaceBusiness.connectWorkspaceComponent(data.components);
        this.workspaceCurrent = data;
        this.workspaceCurrent.mode = 'edit';
        this.menu = 'component'
        resolve(data);
      }).catch(error => {
        reject(error);
      });
    });


  }; // <= select

  this.computeGraph = function(viewBox) {
    let componentsId = this.workspaceCurrent.components.map(c => c._id);
    this.workspaceCurrent.links = sift({
      $and: [{
        source: {
          $in: componentsId
        }
      }, {
        target: {
          $in: componentsId
        }
      }]
    }, this.workspaceCurrent.links)
    if (viewBox) {
      this.viewBox = viewBox;
    }

    var selectedNodes = [];
    var selectedLinks = [];

    if (this.graph != undefined) {
      selectedNodes = sift({
        selected: true
      }, this.graph.nodes).map(n => n.id);
      selectedLinks = sift({
        selected: true
      }, this.graph.links).map(n => n.id);
    }


    this.graph = {};
    this.graph.transform = this.workspaceCurrent.transform
    this.graph.nodes = [];
    this.graph.links = [];
    this.graph.workspace = this.workspaceCurrent;
    this.graph.x = (window.screen.height + (0.2 * window.screen.height)) / 2
    this.graph.y = (window.screen.height - (0.1 * window.screen.height)) / 2
    var inputs = 0;
    var outputs = 0;
    var middles = 0;

    // determine le nombre d inputs et d outputs
    //console.log(this.workspaceCurrent.components);
    for (record of this.workspaceCurrent.components) {
      let connectionsBefore = sift({
        target: record._id
      }, this.workspaceCurrent.links);
      let connectionsAfter = sift({
        source: record._id
      }, this.workspaceCurrent.links);
      //console.log('connections', connectionsBefore, connectionsAfter);
      if (connectionsBefore.length == 0 && record.graphPositionX == undefined && record.graphPositionY == undefined) {
        inputs++;
      } else if (connectionsAfter.length == 0 && record.graphPositionX == undefined && record.graphPositionY == undefined) {
        outputs++;
      } else if (record.graphPositionX == undefined && record.graphPositionY == undefined) {
        middles++;
      }
    }

    var inputsOffset = this.viewBox.height.baseVal.value / (inputs + 1);
    var outputsOffset = this.viewBox.height.baseVal.value / (outputs + 1);
    var middlesOffset = this.viewBox.height.baseVal.value / (middles + 1);

    var inputCurrentOffset = inputsOffset;
    var outputCurrentOffset = outputsOffset;
    var middleCurrentOffset = middlesOffset;


    for (record of this.workspaceCurrent.components) {
      let connectionsBefore = sift({
        target: record._id
      }, this.workspaceCurrent.links);
      let connectionsAfter = sift({
        source: record._id
      }, this.workspaceCurrent.links);
      var node = {
        text: record.type,
        id: record._id,
        graphIcon: record.graphIcon,
        component: record
      };
      if (this.currentProcess != undefined) {
        //console.log('Status SET',record._id,this.currentProcess.steps);
        let step = sift({
          componentId: record._id
        }, this.currentProcess.steps)[0];
        if (step != undefined) {
          node.status = step.status;
        }
      }
      if (connectionsBefore.length == 0 && record.graphPositionX == undefined && record.graphPositionY == undefined) { // si rien n est connecte avant
        node.x = 30;
        node.y = inputCurrentOffset;
        inputCurrentOffset += inputsOffset;
      } else if (connectionsAfter.length == 0 && record.graphPositionX == undefined && record.graphPositionY == undefined) {
        node.x = this.viewBox.width.baseVal.value - 250;
        node.y = outputCurrentOffset;
        outputCurrentOffset += outputsOffset;
      } else { // tous ceux du milieu
        node.x = record.graphPositionX || this.viewBox.width.baseVal.value / 2;
        node.y = record.graphPositionY || middleCurrentOffset;
        if (record.graphPositionY == undefined) {
          middleCurrentOffset += middlesOffset;
        }
      }
      this.graph.x += -node.x
      this.graph.y += -node.y
      console.log("NODE", -node.x, -node.y)
      if (selectedNodes.indexOf(node.id) != -1) {
        node.selected = true;
      }

      this.graph.nodes.push(node);
    }
    if(this.graph.nodes.length > 0){
      console.log("middle", this.graph.x, this.graph.y)
      let x = this.graph.x /  this.graph.nodes.length
      let y = this.graph.y /  this.graph.nodes.length
      let middle = { x, y }
      console.log("middle", middle)
      this.graph.startPosition  = middle
    } else {

      let x = 100;
      let y = 100;
      console.log("NO NODE", x, y)
      this.graph.startPosition  = {x, y}
    }



    for (link of this.workspaceCurrent.links) {
      let id = link._id;
      this.graph.links.push({
        source: sift({
          id: link.source
        }, this.graph.nodes)[0],
        target: sift({
          id: link.target
        }, this.graph.nodes)[0],
        id: id,
        selected: selectedLinks.indexOf(id) != -1
      })
    }

    this.trigger('workspace_graph_compute_done', this.graph);
  }

  this.on('workspace_graph_compute', function(viewBox) {
    this.computeGraph(viewBox);
  });

  this.on('component_current_set', function(data) {
    this.graph.nodes.forEach(n => {
      n.selected = false;
    });

    this.graph.links.forEach(l => {
      l.selected = false;
    });
    sift({
      'component._id': data._id
    }, this.graph.nodes).forEach(n => {
      n.selected = true;
    });
    //this.trigger('workspace_graph_compute_done', this.graph)
    this.trigger('workspace_graph_selection_changed', this.graph);

  });

  this.on('selection_reset', function() {

    this.graph.links.forEach(l => {
      l.selected = false;
      l.connectAfterMode = false;
      l.connectBeforeMode = false;
    });
    this.graph.nodes.forEach(n => {
      n.selected = false;
      n.connectAfterMode = false;
      n.connectBeforeMode = false;
    });
    this.trigger('workspace_graph_selection_changed', this.graph);


  });

  this.on('connection_current_set', function(source, target) {

    this.graph.nodes.forEach(n => {
      n.selected = false
    });

    this.graph.links.forEach(l => {
      l.selected = false;
    });

    sift({
      $and: [{
        'source.component._id': source._id
      }, {
        'target.component._id': target._id
      }]
    }, this.graph.links).forEach(l => {
      l.selected = true
    });
    this.trigger('workspace_graph_selection_changed', this.graph);
  });


  // ----------------------------------------- EVENT  -----------------------------------------

  this.on('workspace_delete', function(record) {
    console.log('ON workspace_delete ||', record);
    this.delete(record);
  }); // <= workspace_delete

  // --------------------------------------------------------------------------------

  this.setGlobalWorkspaceCollection = function(data) {
    //console.log('setGlobalWorkspaceCollection',data.map(r=>r.workspace));
    this.globalWorkspaceCollection = data;
    this.workspaceCollection = sift({
      role: 'owner'
    }, data).map(r => r.workspace);
    this.workspaceShareCollection = sift({
      role: 'editor'
    }, data).map(r => r.workspace);
  }

  this.on('workspace_collection_load', function(record) {
    console.log('workspace_collection_load', this.workspaceCollection);
    if (this.workspaceCollection == undefined) {
      this.load(this.workspaceCurrent).then(data => {
        this.trigger('workspace_collection_changed', this.workspaceCollection);
      })
    } else {
      this.trigger('workspace_collection_changed', this.workspaceCollection);
    }
  }); // <= workspace_collection_load
  // --------------------------------------------------------------------------------



  this.on('workspace_collection_share_load', function(record) {

    if (this.workspaceShareCollection == undefined) {
      this.loadShareWorkspace().then(data => {
        this.trigger('workspace_share_collection_changed', this.workspaceShareCollection);
      })
    } else {
      this.trigger('workspace_share_collection_changed', this.workspaceShareCollection);
    }
  }); // <= workspace_collection_share_load


  this.on('workspace_collection_share_filter', function(filter) {
    var re = new RegExp(filter, 'gi');
    this.trigger('workspace_share_collection_changed', sift({
      name: {
        $regex: re
      }
    }, this.workspaceShareCollection));
  });


  // --------------------------------------------------------------------------------

  this.on('workspace_current_updateField', function(message) {
    console.log('workspace_current_updateField ||', message)
    this.workspaceCurrent[message.field] = message.data;
    this.workspaceCurrent.synchronized = false;
    this.trigger('workspace_current_changed', this.workspaceCurrent);
  }); // <= workspace_current_updateField



  this.on('workspace_current_export', function(anchor) {

    let exportObject = {
      components: this.workspaceCurrent.components,
      links: this.workspaceCurrent.links
    }
    let file = new File([JSON.stringify(exportObject)], this.workspaceCurrent.name.concat('.json'), {
      type: 'application/json'
    });
    let exportUrl = URL.createObjectURL(file);

    console.log(anchor);
    //anchor.prop('href', exportUrl);
    anchor.setAttribute('href', exportUrl);
    anchor.setAttribute('download', this.workspaceCurrent.name.concat('.json'));
    anchor.click();

    //window.open(exportUrl);
  });

  this.on('workspace_current_import', function(file) {
    //console.log('ALLO');
    let reader = new FileReader();
    reader.onload = function(e) {
      let newWorkflow = JSON.parse(e.target.result);
      this.utilStore.ajaxCall({
        method: 'post',
        url: '../data/core/workspace/' + this.workspaceCurrent._id + '/import',
        data: JSON.stringify(newWorkflow),
      }, true).then((updatedWorkspace) => {
        this.workspaceCurrent = updatedWorkspace;
        this.workspaceCurrent.mode = 'edit';
        route('workspace/' + this.workspaceCurrent._id + '/component');
      })
    }.bind(this);
    reader.readAsText(file);
  });


  this.on('item_current_work', function(message) {
    this.stompClient.send('/queue/work-ask', JSON.stringify({
      id: this.itemCurrent._id,
      workspaceId: this.itemCurrent.workspaceId,
      callerId: localStorage.user_id
    }));
  }); //<= item_current_work


  this.on('previewJSON_refresh', function() {
    //console.log('workspace_current_refresh || ', this.workspaceCurrent);
    this.trigger('previewJSON', this.currentPreview);
  }); //
  //--------------------------------------------------------------------------------
  this.on('workspace_current_process_refresh', function() {
    //console.log('workspace_current_refresh || ', this.workspaceCurrent);
    this.trigger('workspace_current_process_changed', this.processCollection);
  }); // <= workspace_current_refresh

  this.on('workspace_current_process_select', function(process) {
    this.currentProcess = process;
    route('workspace/' + this.workspaceCurrent._id + '/component');
  })

  this.on('workspace_current_cancel', function(record) {
    this.workspaceCurrent.mode = 'read'
    this.select(this.workspaceCurrent);
  }); // <= workspace_current_cancel

  // --------------------------------------------------------------------------------

  this.on('workspace_current_edit', function(data) {
    this.workspaceCurrent.mode = 'edit';
    this.trigger('workspace_current_changed', this.workspaceCurrent);

  }); // <= workspace_current_edit

  // --------------------------------------------------------------------------------


  this.on('workspace_current_refresh', function() {
    this.trigger('workspace_editor_menu_changed', this.action);
    this.trigger('workspace_current_changed', this.workspaceCurrent);
  }); // <= workspace_current_refresh

  // --------------------------------------------------------------------------------

  this.on('workspace_current_persist', function() {
    var mode = this.workspaceCurrent.mode;
    if (mode == 'init') {
      this.create().then(ws => {
        route('workspace/' + ws._id + '/component');
      })
    } else if (mode == 'edit') {
      this.update(this.workspaceCurrent).then(data => {
        //nothing to do. specific action in other case
      })
    }
  }.bind(this)); // <= workspace_current_persist

  RiotControl.on('persistClick', function(data) {
    RiotControl.trigger('workspace_current_persist');
  }.bind(this));

  // --------------------------------------------------------------------------------

  this.on('set_componentSelectedToAdd', function(message) {
    //console.log('set_componentSelectedToAdd',message);
    this.componentSelectedToAdd = message;
  }); // <= workspace_current_updateField
  this.on('workspace_current_add_components', function() {
    this.utilStore.ajaxCall({
      method: 'post',
      url: '../data/core/workspace/' + this.workspaceCurrent._id + '/addComponents',
      data: JSON.stringify(this.componentSelectedToAdd.map((c) => {
        return this.workspaceBusiness.serialiseWorkspaceComponent(c)
      })),
    }, true).then(data => {
      this.workspaceCurrent.components = this.workspaceCurrent.components.concat(data);
      route('workspace/' + this.workspaceCurrent._id + '/component');
    })
  }.bind(this));

  // --------------------------------------------------------------------------------

  this.on('workspace_current_delete_component', function(record) {
    this.utilStore.ajaxCall({
      method: 'delete',
      url: '../data/core/workspaceComponent/' + record._id,
      data: JSON.stringify(this.workspaceBusiness.serialiseWorkspaceComponent(record)),
    }, true).then(data => {
      sift({
        "connectionsAfter._id": record._id
      }, this.workspaceCurrent.components).forEach(beforeComp => {
        beforeComp.connectionsAfter.splice(beforeComp.connectionsAfter.indexOf(record), 1);
      });
      sift({
        "connectionsBefore._id": record._id
      }, this.workspaceCurrent.components).forEach(afterComp => {
        afterComp.connectionsBefore.splice(afterComp.connectionsBefore.indexOf(record), 1);
      })
      this.workspaceCurrent.components.splice(this.workspaceCurrent.components.indexOf(record), 1)
      this.trigger('workspace_current_changed', this.workspaceCurrent);
      if (this.viewBox) {
        this.computeGraph();
      }
    })
  }); //<= workspace_current_delete_component

  this.on('workspace_current_move_component', function(component) {
    this.stompClient.send('/topic/workspace_current_move_component.' + this.workspaceCurrent._id, JSON.stringify({
      componentId: component.id,
      x: component.x,
      y: component.y,
      token: localStorage.token
    }));
  });

  ///GESTION DES DROIT DE USER
  this.on('set-email-to-share', function(email) {
    this.emailToShare = email;
  })

  this.on('share-workspace', function(data) {
    console.log('share-workspace |', data, localStorage.token);
    $.ajax({
      method: 'put',
      url: '../data/core/share/workspace',
      data: JSON.stringify({
        email: this.emailToShare,
        worksapce_id: this.workspaceCurrent._id
      }),
      headers: {
        "Authorization": "JTW" + " " + localStorage.token
      },
      // beforeSend: function() {
      //   this.trigger('share_change_send');
      // }.bind(this),
      contentType: 'application/json'
    }).done(function(data) {
      console.log('in share data', data)
      if (data == false) {
        this.trigger('share_change_no_valide')
      } else if (data == "already") {
        this.trigger('share_change_already')
      } else {
        //this.userCurrrent = data,
        console.log('share-workspace', data);
        //this.workspaceBusiness.connectWorkspaceComponent(data.workspace.components);
        this.workspaceCurrent = data.workspace;
        this.workspaceCurrent.mode = 'edit';
        this.trigger('share_change', {
          user: data.user,
          workspace: data.workspace
        });
        route('workspace/' + data.workspace._id + '/user');
      }
    }.bind(this));
  });

  this.on('item_current_connect_before_show', function(data) {
    this.modeConnectBefore = !this.modeConnectBefore;
    this.modeConnectAfter = false;
    this.trigger('item_curent_connect_show_changed', {
      before: this.modeConnectBefore,
      after: this.modeConnectAfter
    });

    sift({
      selected: true
    }, this.graph.nodes).forEach(n => {
      n.connectBeforeMode = true;
    });
    this.trigger('workspace_graph_selection_changed', this.graph);
  });

  this.on('item_current_connect_after_show', function(data) {
    //not used
    this.modeConnectBefore = false;
    this.modeConnectAfter = !this.modeConnectAfter;
    this.trigger('item_curent_connect_show_changed', {
      before: this.modeConnectBefore,
      after: this.modeConnectAfter
    });
    //!not used

    sift({
      selected: true
    }, this.graph.nodes).forEach(n => {
      n.connectAfterMode = true;
    });
    this.trigger('workspace_graph_selection_changed', this.graph);
  });

  this.on('connect_components', function(source, target) {
    this.utilStore.ajaxCall({
      method: 'post',
      url: '../data/core/workspaceComponent/connection',
      data: JSON.stringify({
        workspaceId: this.workspaceCurrent._id,
        source: source._id,
        target: target._id
      }),
    }, true).then(links => {
      console.log('connectedComps', links);
      // source.connectionsAfter.push(connectedComps.target);
      // target.connectionsBefore.push(connectedComps.source);
      // this.workspaceBusiness.connectWorkspaceComponent(this.workspaceCurrent.components);
      this.workspaceCurrent.links = links;
      this.trigger('workspace_current_changed', this.workspaceCurrent);
      if (this.viewBox) {
        this.computeGraph();
      }
    })
  });

  this.on('disconnect_components', function(link) {
    this.utilStore.ajaxCall({
      method: 'delete',
      url: '../data/core/workspaceComponent/connection',
      data: JSON.stringify({
        workspaceId: this.workspaceCurrent._id,
        linkId: link.id,
      }),
    }, true).then(links => {
      console.log('connectedComps', links);
      this.workspaceCurrent.links = links;
      this.trigger('workspace_current_changed', this.workspaceCurrent);
      if (this.viewBox) {
        this.computeGraph();
      }
    })
  });

  this.on('item_persist', function(item) {
    this.utilStore.ajaxCall({
      method: 'put',
      url: '../data/core/workspaceComponent',
      data: JSON.stringify(this.workspaceBusiness.serialiseWorkspaceComponent(item)),
    }, true).then(data => {
      item = data;
      //this.workspaceBusiness.connectWorkspaceComponent(this.workspaceCurrent.components);
      this.trigger('workspace_current_changed', this.workspaceCurrent);
      if (this.viewBox) {
        this.computeGraph();
      }
    }).catch(error => {
      throw error;
    });
  });

  this.on('workspace_editor_change_menu', function(menu) {
    this.menu = menu;
    this.trigger('workspace_editor_menu_changed', this.menu);
  });

  //-----------------------------------  COMPONENT


  this.updateComponent = function() {
    return new Promise((resolve, reject) => {
      utilStore.ajaxCall({
        method: 'put',
        url: '../data/core/workspaceComponent',
        data: JSON.stringify(this.workspaceBusiness.serialiseWorkspaceComponent(this.itemCurrent)),
      }, true).then(data => {
        this.itemCurrent = data;
        //this.trigger('item_current_persist_done', this.itemCurrent);
        resolve(this.itemCurrent);
      }).catch(error => {
        reject(error);
      });
    });
  }; //<= update

  // --------------------------------------------------------------------------------

  this.persistComponent = function() {
    this.updateComponent().then(data => {
      route('workspace/' + data.workspaceId + '/component')
    })
  } //<= persist

  this.on('item_current_updateField', function(message) {
    utilStore.objectSetFieldValue(this.itemCurrent, message.field, message.data);
    //this.itemCurrent[message.field] = message.data;
    this.trigger('item_current_changed', this.itemCurrent);
    this.stompClient.send('/topic/workspace_current_updateComponentField.' + this.workspaceCurrent._id, JSON.stringify({
      field: message.field,
      data: message.data,
      componentId: this.itemCurrent._id,
      token: localStorage.token
    }));
  }); //<= item_current_updateField

  // --------------------------------------------------------------------------------

  this.on('item_current_persist', function(message) {
    this.persistComponent();
  }); //<=  item_current_persist

  this.on('component_preview', () => {
    this.utilStore.ajaxCall({
      method: 'get',
      url: '../data/core/componentData/' + this.itemCurrent._id + '/' + this.currentProcess._id
    }, true).then(data => {
      this.currentPreview = data;
      this.trigger('process_result', this.currentPreview);
    })
  });

  this.on('item_current_cancel', function(data) {
    if (this.itemCurrent) {
      this.itemCurrent.mode = undefined;
    }
  });

  this.on('component_current_set', function(data) {
    //console.log('component_current_set 1');
    this.itemCurrent = data;
  });

  this.on('component_current_select', function(data) {
    this.itemCurrent = data;
    this.trigger('component_current_select_done');
  }); //<= item_current_select

  this.on('component_current_connections_refresh', function() {
    let beforeLinks = sift({
      target: this.itemCurrent._id
    }, this.workspaceCurrent.links);
    let beforeComponents = sift({
      "_id": {
        "$in": beforeLinks.map(l => l.source)
      }
    }, this.workspaceCurrent.components);
    let afterLinks = sift({
      source: this.itemCurrent._id
    }, this.workspaceCurrent.links);
    let afterComponents = sift({
      "_id": {
        "$in": beforeLinks.map(l => l.target)
      }
    }, this.workspaceCurrent.components);
    this.trigger('component_current_connections_changed', {
      beforeComponents: beforeComponents,
      afterComponents: afterComponents
    });
  });

  this.refreshComponent = function(triggerConnections) {
    this.trigger('item_current_editor_changed', this.itemCurrent.editor);
    this.modeConnectBefore = false;
    this.modeConnectAfter = false;
    this.trigger('item_curent_connect_show_changed', {
      before: this.modeConnectBefore,
      after: this.modeConnectAfter
    });
    this.trigger('item_current_changed', this.itemCurrent);
  }

  this.on('component_current_refresh', function() {
    this.refreshComponent();
  }); //<= item_current_select





}
