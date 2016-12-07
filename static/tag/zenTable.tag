<zenTable class="containerV" style="align-items:stretch">
  <div class="commandBar containerH">
    <div>
    </div>
    <div>{opts.title}</div>
    <div class="containerH commandGroup">
      <div onclick={addRowClic} class="commandButton">+</div>
      <div onclick={delRowClic} class="commandButton">-</div>
    </div>

  </div>
 <div name="tableHeader" class="tableHeader">
  <yield from="header"/>
 </div>
  <div class="containerV" style="flex:1" name="tableBodyContainer">
    <div class="table" name="tableBody" >
     <div class="tableRow {selected:selected} {mainSelected:mainSelected}" name="tableRow" onclick={rowClic} data-rowid={rowid} each={indexedData}>
       <yield from="row"/>
     </div>
   </div>
  </div>


 <script>
    var arrayChangeHandler = {
      tag:this,
      get: function(target, property,third,fourth) {
        switch (property) {
          case 'push':
          case 'unshift':
            return function(data){
              target[property](data);
              console.log('update')
              this.tag.update();
            }.bind(this)
            break;
          default:
            return target[property];
        }
      },
      set: function(target, property, value, receiver) {
        //console.log('setting ' + property + ' for ' + target + ' with value ' + value);
        target[property] = value;
        // you have to return true to accept the changes
        return true;
      }
    };

//  this.innerData = new Proxy([], arrayChangeHandler);

   this.innerData = [];
   //arrayChangeHandler.tag=this;
    Object.defineProperty(this, 'data', {
       set: function (data) {
         //this.innerData=new Proxy(data, arrayChangeHandler);
         this.innerData=data;
         this.update();
         //this.reportCss();
         //this.reportFlex();
         //console.log(this.items,data);
       }.bind(this),
       get: function () {
        return this.innerData;
      },
      configurable: true
    });

   Object.defineProperty(this, 'indexedData', {
      get: function () {
       var recordId=0;
       for (record of this.innerData){
         record.rowid=recordId++
       }
       return this.innerData;
      },
      configurable: true
   });

   rowClic(e){
     var index=parseInt(e.currentTarget.dataset.rowid)

     if(!e.ctrlKey){
       for(data of this.innerData){
         data.selected=false;
         data.mainSelected=false;
       }
       this.innerData[index].mainSelected=true;
       this.trigger('rowSelect',this.innerData[index])
     }
     var selected= this.innerData[index].selected||false;
     this.innerData[index].selected=!selected;

   }

   addRowClic(e){
     //var index=parseInt(e.currentTarget.dataset.rowid)
     //console.log(index);
     this.trigger('addRow')
   }

   delRowClic(e){
     for(data of this.innerData){
       if(data.selected){
        this.trigger('delRow',data)
       }
     }
   }

   recalculateHeader(){
     var headers = this.tableHeader.children;
     for(var row of this.root.querySelectorAll('.tableRow')){
       for(var headerkey in headers){
         var numkey = parseInt(headerkey);
         if (!isNaN(numkey)){
           //console.log(row.children[numkey].getBoundingClientRect().width);
           var width=row.children[numkey].getBoundingClientRect().width;
           var cssWidth=width+'px';
           headers[headerkey].style.width=cssWidth;
           headers[headerkey].style.maxWidth=cssWidth;
           headers[headerkey].style.minWidth=cssWidth;
           headers[headerkey].style.flexBasis=cssWidth;
           //console.log(headers[headerkey].style);
         }
       }
       break;
     }
   }

   this.on('mount', function () {
     //this.reportCss();
     addResizeListener(this.tableBody, function(){this.recalculateHeader()}.bind(this));
     this.tableBodyContainer.addEventListener('scroll',function(e){
       //console.log(this.tableBodyContainer.scrollLeft);
       this.tableHeader.scrollLeft=this.tableBodyContainer.scrollLeft;
     }.bind(this));
   });
  </script>
  <style>

    .commandBar{
      border-bottom-style: solid;
      border-width: 1px;
    }
    .table{
      display:table;
      /*display: flex;
      flex-direction: column;*/
      border-style: solid;
      border-width: 1px;
      border-color: #3883fa;
      width: 100%;
    }
    .tableHeader{
      display: flex;
      overflow-x: hidden;

    }

    .tableRow{
      display:table-row;
      /*display: flex;*/
    }
    .tableRow:nth-child(odd) {
      background-color: #cce2ff;
    }
    .tableRow:hover>*, .tableRow.selected>*,.tableRow.mainSelected>* {
      /*background-color: #3883fa;*/
      border-top-style: solid;
      border-bottom-style: solid;
      border-top-width: 3px;
      border-bottom-width: 3px;
      padding-top: 2px;
      padding-bottom: 2px;
    }

    .tableRow.selected>*{
          border-color: grey;
    }

    .tableRow.mainSelected>*, .tableRow:hover>*{
          border-color: #3883fa;
    }

    .tableRow:hover>*:first-child, .tableRow.selected>*:first-child{
      border-left-style: solid;
      border-left-width: 3px;
      padding-left: 2px;
    }

    .tableRow:hover>*:last-child, .tableRow.selected>*:last-child{
      border-right-style: solid;
      border-right-width: 3px;
      padding-right: 2px;
    }


    .tableRow{
      cursor: pointer;
    }


    .tableHeader>*{
      /*display: inline-block;*/
      overflow: hidden;
      padding: 5px;
      border-right-style: solid;
      border-width: 1px;
    }
    .tableHeader>*:last-child{
        border-right-style: none;
    }

    .tableRow>*{
      display:table-cell;
      padding: 5px;
      border-right-style: solid;
      border-width: 1px;
      border-color: grey;
    }
    .tableRow>*:last-child{
      border-right-style: none;
    }

    .tableHeader{
      color: #cce2ff;
      background-color: #3883fa;
    }


  </style>

</zenTable>
