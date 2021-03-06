/**
 * Created by zhuqizhong on 17-8-16.
 */
const SerialPort = require('serialport');

/**
 * Created by zhuqizhong on 16-12-2.
 */



const util = require('util');
const WorkerBase = require('yeedriver-base/WorkerBase');
const _ = require('lodash');
const vm = require('vm');
const RWActuator = require('./RWActuator')
const MAX_WRITE_CNT = 50;
/**
 * sids的说明
 *
 *  {devId,devType}
 *
 *
 * options的说明：
 *
 * devName
 *
 */
class SimpleSerial extends WorkerBase{
    constructor(maxSegLength, minGapLength){
        super(maxSegLength, minGapLength);
        this.factories = {};
        this.devInfo = {};
        setInterval(()=>{
            _.each(this.factories ||{},(device)=>{
                device.OnTick();
            })
        },50)
    }


    initDriver(options) {
       // WorkerBase.prototype.initDriver(options);

        function __eval(str){
            try{
                let script = new vm.Script(" definition = " + str);
                let newObj = {};
                script.runInNewContext(newObj);
                return newObj.definition;
            }catch(e){
                console.error(e);
            }

        }
        if(!this.inited){
            this.inited = true;
            this.setRunningState(this.RUNNING_STATE.CONNECTED); //设置成运行中，允许数据收
            this.setupEvent();
        }
        let devType = 'serial';
        let opt;
        if(options.net){
            opt = _.isString(options.net)?__eval(options.net):options.net;
            if(options.net.type === 'server'){
                devType = 'server';
            }else{
                devType = 'client';
            }

        }else{
            opt = _.isString(options.serial)?__eval(options.serial):options.serial;
        }

        if(!this.actuator){
            this.actuator = new RWActuator(devType);

        }
        this.actuator.setConfig(opt);
        this.actuator.start();
        _.each(options.sids,  (type, devId) =>{
            let classType = require("./drivers/" + type);
            if(!this.factories[type]){
                this.factories[type] =  new classType(this.actuator);

                this.factories[type].on('regChanged',(data)=>{
                    this.setOneMemChanged(data.devId,data.memTag,data.memId)
                })

            }
            this.factories[type].createDevice(devId,this.actuator);
            this.devInfo[devId] = this.factories[type];

        });
        if (options.readConfig) {
            try {

                this.SetAutoReadConfig(__eval(options.readConfig));
            } catch (e) {
                console.error('error in read config:', e.message || e);
            }
        }
    }

    ReadWQ (mapItem,  devId){
        return this.CreateWQReader(mapItem,(reg)=>{
            return this.devInfo[devId] && this.devInfo[devId].ReadWQ(devId,reg);
        })
    }
    WriteWQ (mapItem, value, devId){
        return this.CreateWQWriter(mapItem,value,(reg,value)=>{
            return this.devInfo[devId] && this.devInfo[devId].WriteWQ(devId,reg,value);
        })
    }
}



module.exports = new SimpleSerial();

