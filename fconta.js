//==================================================================================================================
// Funciones de date
//------------------------------------------------------------------------------------------------------------------
function tk(v,c) {return Math.ceil(v/(1000*900*c));}  //Base cuartohoraria
function tkC(v) { return tk(v, 1);}
function tkH(v) { return tk(v, 4);}
function tkD(v) { return tk(v, 24*4);}

function dt(s)  {return new Date(s);}
const dt0=dt("2020-01-01");
const dth=new Date();

function difDt(d1,d2) {return d1.getTime()-d2.getTime();}
function dif0Dt(d)    {return difDt(d,dt0);}
function difhDt(d)    {return difDt(d,dth);}


function dtISO(d) {[date, time] = d.toISOString().split('T'); return date;}


//==================================================================================================================
// Funciones de series
//------------------------------------------------------------------------------------------------------------------
const dias_festivos =  [
  "2020-01-01","2020-05-01","2020-08-15","2020-10-12","20202-12-08","2020-12-25",
  "2021-01-01","2021-05-01","20201-10-12","2021-11-01","20201-12-06","2021-12-08", "20201-12-25",
  "2022-01-01","2022-01-06","2022-08-15","2022-10-12","2022-11-01","2022-12-06","2022-12-08"];
const dfest = dias_festivos.map( (s)=> tkD(dif0Dt(dt(s))));   //En días desde dt0

let datos=[];
let eDesde= dt0;
let eHasta= dth;

const eSeriesName = [['E. Activa','E. Inductiva','E. Capacitiva'],['P. Activa','cos(&varphi;)','cos(&varphi;)'],['E. Activa','E. Inductiva','E. Capacitiva']];
const eSeriesUds=[['kWh','kVArh Ind.', 'kVArh Cap.'],['kW','ind.','cap.'],['€','€', '€']];
const eSeriesApprox=[['sum','sum','sum'],['high','low','low'],['sum','sum','sum']];
const eTitle=['Consumo','Potencia','Excesos facturados'];
const eSeriesDec=[[0,0,0],[0,2,2],[2,2,2]];

const PowerP15 = 345;
const PowerP6=500;
const cosFiInd0=0.95;
const cosFiInd1=0.80;
const cosFiCap=0.98;
const pen_react = [0.041554, 0.062332, 0.05 ];

let energia_activa=[];
let energia_reactiva=[];
let cosfi=[];
let energia_inductiva=[];
let energia_capacitiva=[];
let potencia_activa=[];
let cosfi_inductivo=[];
let cosfi_capacitivo=[];
let xEact=[];
let xEind=[];
let xEcap=[];
let zoom=[1,2,6,6,6,7];
let pagina=0;
let chart;
let titulo="";

//==================================================================================================================
// Grupos
//------------------------------------------------------------------------------------------------------------------
const eGrupo = Object.freeze({CuartoHora:0, Hora:1, Dia:2, Semana:3, Mes:4, Anyo:5});
const  unidades_grupo= [  ['minute',[1]],['hour', [1, 2, 3, 4, 6, 8, 12]], ['day', [1]], ['week', [1]], ['month', [1, 3, 6]], ['year', null]];
const tipo_grupo = ['line','line','line','column','column','column'];
let  grupo=eGrupo.CuartoHora;

//==================================================================================================================
const formato_fecha=Object.freeze({
  minute: ['%A, %e %b, %H:%M', '%A, %e %b, %H:%M', '-%H:%M'],
  hour: ['%A, %e %b, %H:%M', '%A, %e %b, %H:00', '-%H:00'],
  day: ['%A, %e %b, %Y', '%A, %e %b, %Y', '-%A, %e %b, %Y'],
  week: ['Sem. %A, %e %b, %Y', '%A, %e %b, %Y', '-%A, %e %B, %Y'],
  month: ['%B %Y', '%B %Y', '-%B %Y'],
  year: ['%Y', '%Y', '-%Y']
});

const opc_gen={
  lang:{
    months: ['Enero', 'Febrero','Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
    shortMonths:[ 'ene', 'feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'],
    weekdays: ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'],
    shortWeekdays: ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'],
    numericSymbols: [null, ' millones']
  },
  time: { timezone: 'Europe/Madrid'}
};
const opciones= {
//title: { text: 'Consumos'   },
  credits:{ enabled: false},
  tooltip: {
    formatter: function() {
      let s = "";
      let rango = this.points[0].series.currentDataGrouping;
      let tipo=rango.unitName;
      let fdesde = formato_fecha[tipo][1];      let fhasta = formato_fecha[tipo][2];
      let x = this.x-(this.x % 900);
      if (rango.count >1)   s ='<b>' + Highcharts.dateFormat(fdesde, x)+Highcharts.dateFormat(fhasta, x+rango.count*rango.unitRange)+'</b><br/>';
      else                  s = '<b>' + Highcharts.dateFormat(fdesde, x) + '</b><br/>';
      let i=0;
      this.points.forEach(point => {
        s+= `<br/><span style="color:${point.color}">\u25CF</span> ${eSeriesName[pagina][i]}: <b>  ${point.y.toFixed(eSeriesDec[pagina][i])}  ${eSeriesUds[pagina][i]}</b><br/>`;
        i=i+1;
      });
      return s;
    },
    split: true},
  rangeSelector: {
    selected: 0,
    inputEnabled: false,
    verticalAlign: 'bottom',
    buttonPosition: {align: 'right'},
    inputPosition: {align: 'center'},
    inputDateFormat: "%e %b, %Y",
    buttons: [
      {type: 'day',  count: 1, text: '1 dia',},
      {type: 'week', count: 1, text: '1 sem',},
      {type: 'month', count: 1, text: '1mes',},
      {type: 'month', count: 3, text: '3m'},
      {type: 'month', count: 6, text: '6m'},
      {type: 'ytd', text: 'Act', title: 'Desde el 1 de enero del año actual'},
      {type: 'year', count: 1, text: '1año'},
      {type: 'all', text: 'Todo' }
    ],
    buttonTheme: { // styles for the buttons
      fill: 'none',      stroke: 'none',  'stroke-width': 0,  r: 8,
      style: {color: '#039',   fontWeight: 'bold' },
      states: {
        hover: {  },
        select: { fill: '#039', style: { color: 'white' } }
// disabled: { ... }
      }
    },
    inputBoxBorderColor: 'gray', inputBoxWidth: 120,    inputBoxHeight: 18,
    inputStyle: { color: '#039', fontWeight: 'bold'  },
    labelStyle: { color: 'silver', fontWeight: 'bold'},
  },
  xAxis: {
    type: 'datetime',
    dateTimeLabelFormats:formato_fecha,
    events: {
      setExtremes(e) {
        eDesde =  new Date(e.min);
        eHasta = new Date(e.max) ;
        fechasDom();
      }
    }
  },
  plotOptions: {
    series: {
      pointStart: Date.UTC(2020, 0, 1),   pointInterval: 900 * 1000,
      marker: {enabled: false, symbol:'circle', radius: 3},
      animation: true,      boostThreshold: 1,     turboThreshold: 1,
    },
  },
  yAxis:[
    {
      title: {text: `${eSeriesName[pagina][0]} [${eSeriesUds[pagina][0]}]`},
      height: '33%', labels: {align: 'right', x: -3}, opposite: false,
    },{
      title: {text:`${eSeriesName[pagina][1]} [${eSeriesUds[pagina][1]}]`},
      top: '33%',      height: '33%',      offset: 30,      labels: {align: 'left', x: -3 },      opposite: false,
    },{
      title: {text:`${eSeriesName[pagina][2]} [${eSeriesUds[pagina][2]}]`},
      top: '66%',      height: '33%',      offset: 30,      labels: {align: 'left', x: -3 },      opposite: false,
    }
  ],
  series: [
    { name: eSeriesName[pagina][0],data: [0], yAxis: 0, showInNavigator: true, },
    { name: eSeriesName[pagina][1],data: [1], yAxis: 1, showInNavigator: false,},
    { name: eSeriesName[pagina][2],data: [2], yAxis: 2, showInNavigator: false,}
  ]
};
//==================================================================================================================
function agrupa(agrupacion, pag) {
//==================================================================================================================
  if (agrupacion>=0)
    grupo=agrupacion;
  pagina=pag;
  //titulo.innerHTML = eTitle[pagina];
  let eData=[];
  for( let i=0;i<3;i++) {
    switch (pag) {
      case 0:
        eData = (i === 0) ? energia_activa : (i === 1) ? energia_inductiva : energia_capacitiva;
        break;
      case 1:
        eData = (i === 0) ? potencia_activa : (i === 1) ? cosfi_inductivo : cosfi_capacitivo;
        break;
      case 2:
        eData = (i === 0) ? xEact : (i === 1) ? xEind : xEcap;
        break;

    }
    let opc_updte = {
      title: {text: `${eSeriesName[pagina][i]} [${eSeriesUds[pagina][i]}]`},
      cumulative: false,
      dataGrouping: {
        enabled: true,
        dateTimeLabelFormats: formato_fecha,
        forced: true,
        approximation: eSeriesApprox[pagina][i],
        anchor: 'end',
        units: unidades_grupo.slice(grupo),
      },
      type: tipo_grupo[grupo],
      data: eData,
    };
    chart.series[i].update(opc_updte, false);

    chart.yAxis[i].update({title: {text: `${eSeriesName[pagina][i]} [${eSeriesUds[pagina][i]}]`},}, false);
    if (pagina === 1) {
      switch (i) {
        case 0:
          chart.yAxis[i].update({
            plotLines: [
              {
                value: PowerP6,
                color: 'darkred',
                dashStyle: 'shortdash',
                width: 2,
                label: {text:'Potencia P6 500 kW', align: 'right'}
              },
              {
                value: PowerP15,
                color: 'red',
                dashStyle: 'shortdash',
                width: 2,
                label: {text: 'Potencia P1-P5 348 kW', align: 'right'}
              }],
          }, false);
          break
        case 1:
          chart.yAxis[i].update({
            plotLines: [
              {
                value: cosFiInd0,
                color: 'green',
                dashStyle: 'shortdash',
                width: 2,
                label: {text: 'cos(&varphi;) 0,95', align: 'right'}
              },
              {
                value: cosFiInd1,
                color: 'red',
                dashStyle: 'shortdash',
                width: 2,
                label: {text: 'cos(&varphi;) 0,8', align: 'right'}
              }],
          }, false);
          break
        case 2:
          chart.yAxis[i].update({
            plotLines: [{
              value: cosFiCap,
              color: 'green',
              dashStyle: 'shortdash',
              width: 2,
              label: {text: 'cos(&varphi;) 0,98', align: 'right'}
            },{
              value: cosFiCap,
              color: 'red',
              dashStyle: 'shortdash',
              width: 0,
              label: {text: '', align: 'right'}
            }],
          }, false);
          break
      }
    } else {
      chart.yAxis[i].update({
        plotLines: [{
          value: cosFiCap,
          color: 'red',
          dashStyle: 'shortdash',
          width: 0,
          label: {text: '', align: 'right'}
        },{
          value: cosFiCap,
          color: 'red',
          dashStyle: 'shortdash',
          width: 0,
          label: {text: '', align: 'right'}
        }],
      }, false);

    }

  }
  extrem=chart.xAxis[0].getExtremes();

  chart.redraw();
  if (agrupacion !== -1)
    chart.rangeSelector.clickButton(zoom[grupo], false);
  else
    //chart.xAxis[0].getExt
  chart.xAxis[0].setExtremes(extrem.min,extrem.max);
}

function isP6(horas)
{
  let hora= horas%24;
  let dias=(horas/24);
  let dsem=dias%7;
  return ( (hora <8) || (dsem === 3) || (dsem===4) || dfest.includes(dias));
}
//==================================================================================================================
async function trae_datos()
//==================================================================================================================
{
  //const response = await fetch('https://anuit.ml/knt2202.js');
  let nom_pag = location.href.split("/").slice(-1).toString();

  const datos_contador = "./consumo.js";
  console.log(datos_contador);
  const response = await fetch(datos_contador);
  const buffer = await response.arrayBuffer();
  const len = buffer.byteLength/2/2;
  let uia=new Int16Array(buffer);
  for (let i=0; i<=1; i++) {
    datos[i]=Array.from(uia.slice(i*len,(i+1)*len));
  }
  energia_activa=datos[0];
  energia_reactiva=datos[1];
  cosfi= datos[0].map((x, i) => (x>0) ? x/Math.sqrt(Math.pow(x,2)+Math.pow(datos[1][i],2)): 1 );
  energia_inductiva =datos[1].map(element => (element>0) ? element : 0);
  energia_capacitiva= datos[1].map(element => (element>0) ? 0 : -1*element);

  potencia_activa = energia_activa.map(element => element*4);
  cosfi_inductivo= cosfi.map((x, i) => (energia_reactiva[i] >=0) ? x : 1);
  cosfi_capacitivo = cosfi.map((x, i) => (energia_reactiva[i] <0) ? x : 1);

  xEact = energia_activa.map((x, i) => {
    let diff = (potencia_activa[i]- PowerP15);
    if (diff>0) return diff*1.4064*0.5;
    return 0;
  });
  xEind = energia_inductiva.map((x, i) =>
  {
    if (isP6(i/4)) return 0;
    if (cosfi_inductivo[i]< cosFiInd1) return x*pen_react[1];
    if (cosfi_inductivo[i]< cosFiInd0) return x*pen_react[0];
    return 0;
  });
  xEcap = energia_capacitiva.map((x, i) => (cosfi_capacitivo[i]< cosFiCap  && isP6(i)) ? x*pen_react[2] : 0);

  Highcharts.setOptions(opc_gen);
  opciones.series[0].data = energia_activa;
  opciones.series[1].data = energia_inductiva;
  opciones.series[2].data = energia_capacitiva;
  chart = Highcharts.stockChart('container', opciones);
  agrupa(0,0);
  calcula_intervalo(5);//TodohDesde.min = dtISO(dt0);
  hDesde.min = dtISO(dt0);
  hHasta.min = dtISO(dt0);
  hDesde.max = dtISO(dth);
  hHasta.max = dtISO(dth);

}
//==================================================================================================================
// Fechas
//==================================================================================================================
function domAll(ele){ return document.querySelectorAll(`[name=${ele}]`);}
function domId(ele){ return document.querySelector(`#${ele}`);}
var hDesde = domId("cal_desde");
var hHasta = domId("cal_hasta");
var hUnits = domId("cal_units");
var sel_pag = domId("sel-pag");
var sel_grup = domId("sel-grup");

function dtInc(d,tipo, unidades)
{
  let dt=new Date(+d);
  //console.log(dtISO(eDesde), dtISO(eHasta),dtISO(dt))
  //console.log("dtInc Calculando intervalo"+tipo + "Uds " + unidades)
  switch (tipo) {
    case 1: dt.setDate(dt.getDate() +  unidades);          break;
    case 2: dt.setDate(dt.getDate() + 7 * unidades);          break;
    case 3: dt.setMonth(dt.getMonth() + unidades);      break;
    case 4: dt.setFullYear(dt.getFullYear() + unidades);  break;
    default:                                                   break;
  }

  dt = (dif0Dt(dt)<0) ? dt0 : (difhDt(dt)>0) ? dth : dt;
  //console.log(dtISO(eDesde), dtISO(eHasta),dtISO(dt))
  return dt;
}
function fechasDom()
{
  if (+eHasta < +eDesde)
  {
    eDesde = dt0;
    eHasta = dth;
  }
  hDesde.value = dtISO(eDesde);
  hHasta.value = dtISO(eHasta);

}

function calcula_intervalo(tipo)
{
  let unidades =parseInt(hUnits.value);
  if (tipo===5) {
    eDesde = dt0;
    eHasta = dth;
  }else {
    if (unidades >0)
      eHasta = dtInc(eDesde,tipo,unidades);
    else  eDesde = dtInc(eHasta,tipo,unidades);
  }
  fechasDom();
  ajusta_extremos();
}
function ajusta_extremos()
{
  chart.xAxis[0].setExtremes(+eDesde,+eHasta);
}
//==================================================================================================================
// DOM
//==================================================================================================================


document.addEventListener('DOMContentLoaded', function() {

  sel_grup.addEventListener('change', () =>  agrupa(parseInt(sel_grup.value),pagina));
  sel_pag.addEventListener('change', () => agrupa(-1,parseInt(sel_pag.value)));
  domAll("interv").forEach(e =>e.addEventListener('click', () =>calcula_intervalo(parseInt(e.value))));
  hDesde.addEventListener('change',()=> {eDesde=new Date(hDesde.value); ajusta_extremos();})
  hHasta.addEventListener('change',()=> {eHasta=new Date(hHasta.value); ajusta_extremos();})
  trae_datos();
  registerSW();
});

window.addEventListener('load', e => {

});

async function registerSW() {
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./sw.js');
      console.log('Service Worker Registered');
    } catch (e) {
      alert('ServiceWorker registration failed. Sorry about that.');
    }
  } else {
    document.querySelector('.alert').removeAttribute('hidden');
  }
}
