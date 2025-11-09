from datetime import date, timedelta
from requests import Session
from zipfile import ZipFile
import pandas as pd
import numpy as np
import io
import json
import os
import sys

class IberException(Exception):
    pass

class ResponseException(IberException):
    def __init__(self, status_code):
        super().__init__("Response error, code: {}".format(status_code))

class LoginException(IberException):
    def __init__(self, username):
        super().__init__('Unable to log in')

class SessionException(IberException):
    def __init__(self):
        super().__init__('Session required, use login() method to obtain a session')

class NoResponseException(IberException):
    pass

class SelectContractException(IberException):
    pass

class Iber:

    __domain = "https" \
               "://www.i-de.es"
    __login_url = __domain + "/consumidores/rest/loginNew/login"
    __obtener_periodoacv_url = __domain + "/consumidores/rest/consumoNew/exportarACSVPeriodoConsumo/fechaInicio/{}00:00:00/fechaFinal/{}00:00:00/tipo/cuartohoraria/"  # date format: 07-11-2020 - that's 7 Nov 2020
    __headers = {
        'User-Agent': "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Ubuntu Chromium/77.0.3865.90 Chrome/77.0.3865.90 Safari/537.36",
        'accept': "application/json; charset=utf-8",
        'content-type': "application/json; charset=utf-8",
        'cache-control': "no-cache"
    }

    def __init__(self, session=None):
        self.__session = session

    def login(self, user, password, session=Session()):
        #session.verify=False
        #certificados = "/usr/local/lib/python2.7/dist-packages/certifi/cacert.pem"
        #session.cert=certificados
        session.verify = False
        self.__session = session
        login_data = "[\"{}\",\"{}\",null,\"Linux -\",\"PC\",\"Chrome 77.0.3865.90\",\"0\",\"\",\"s\"]".format(user, password)
        response = self.__session.request("POST", self.__login_url, data=login_data, headers=self.__headers)
        if response.status_code != 200:
            self.__session = None
            raise ResponseException(response.status_code)
        json_response = response.json()
        if json_response["success"] != "true":
            self.__session = None
            raise LoginException(user)

    def __check_session(self):
        if not self.__session:
            raise SessionException()

    def consumo(self, start, end):
        self.__check_session()
        start_str = start.strftime('%d-%m-%Y')
        end_str = end.strftime('%d-%m-%Y')
        response = self.__session.request("GET", self.__obtener_periodoacv_url.format(start_str, end_str), headers=self.__headers)
        if response.status_code != 200:
            raise ResponseException(response.status_code)
        if not response.text:
            raise NoResponseException
        return response.content


anyo_ini=2020
dia_ini=pd.to_datetime('01/01/2020 0:0:00')
dia_fin=pd.to_datetime('31/12/2048 0:0:00')
dia_ini_anyo=pd.to_datetime('01/01/2022 0:0:00')
hoy = pd.Timestamp.today()
ndias=(dia_fin-dia_ini).days
nd = ndias*24*4
dst=[25, 31, 30, 29, 27, 26, 25, 31, 29, 28, 27, 26, 31, 30, 29, 28, 26]

#======================================================================================================================
#Cargo buffers
#======================================================================================================================
os.chdir(sys.path[0])
with open("consumo.json") as file:
    smm = json.load(file)

print(smm["email"],smm["clave"],smm["cups"])
fichero = "consumo.js"
email = smm["email"]
clave = smm["clave"]


tipo=np.int16
i=0
p= np.zeros(nd, dtype=tipo)
q= np.zeros(nd, dtype=tipo)
c = np.zeros(int(2*nd), dtype=tipo)
try:
    t=np.fromfile(fichero, dtype=tipo)
    nt=len(t)
    nt2=int(nt/2)
    p[0:nt2]=t[0:nt2]
    q[0:nt2]=t[nt2:nt]
except FileNotFoundError:
    i=2

#======================================================================================================================
#Cargo zip
#======================================================================================================================
connection = Iber()
from_date = date.today() - timedelta(days=365)
until_date = date.today() - timedelta(days=1)
print('Conectando')
connection.login(email, clave)
print('Leyendo datos')
mi_consumo = connection.consumo(from_date, until_date)
file_data = io.BytesIO(mi_consumo)
with ZipFile(file_data, 'r') as contazip:
    listaFicheros = contazip.namelist()
    contazip.extractall()
    if ('P1D' in listaFicheros[0]):
        datad = pd.read_csv(listaFicheros[0], delimiter=';')  # Diario
        datac = pd.read_csv(listaFicheros[1], delimiter=';')   #Cuarto horario
    else:
        datad = pd.read_csv(listaFicheros[1], delimiter=';')  # Diario
        datac = pd.read_csv(listaFicheros[0], delimiter=';')  # Cuarto horario
os.remove(listaFicheros[0])
os.remove(listaFicheros[1])
#======================================================================================================================
#Cuarto horario
#======================================================================================================================
print('PRocesando cuartohorario')
hora=pd.to_datetime(datac['FECHA-HORA'])
ver=datac['INV / VER']
pot=datac['CONSUMO kWh']
q1=datac['REACT Q1']
q4=datac['REACT Q4']
qot=q1-q4

#Relleno buffers. Indice i sigue valor en csv, Indice ni en buffer
i = 0
dant=hora[len(hora)-1]
for d in hora:
    ndias = (d - dia_ini).days
    ni =  int(d.minute/15+(d.hour+ ndias*24)*4)
    if ni<0 or ni >= nd:
        ni=0
    if d!=dant: #No es cambio de hora
        p[ni]=pot[i]
        q[ni]=qot[i]
    i=i+1
    dant=d
#======================================================================================================================
#Diario
#======================================================================================================================
print('Procesando diario')
hora=pd.to_datetime(datad['FECHA-HORA'])
ver=datad['INV / VER']
pot=datad['CONSUMO kWh']
q1=datad['REACT Q1']
q4=datad['REACT Q4']
qot=q1-q4
#Ajusto dia con 25 horas por cambio horario
i = 0
dant = hora[len(hora)-1]
for d in hora:
    ndias = (d - dia_ini).days
    ni =  int(d.minute/15+(d.hour+ ndias*24)*4)
    if ni<0 or ni >= nd:
        ni=0
    if d==dant: #Hay cambio de hora. Reparto el dato de la hora en cuartos. Indice i sigue valor en csv, indice ni en p
        addp = round(pot[i] / 4)
        p[ni]=p[ni]+pot[i]-3*addp
        addq = round(qot[i] / 4)
        q[ni]=q[ni]+ qot[i] - 3*addq
        for di in range(1,4): #Completo ajuste
            p[ni-di]=p[ni-di]+addp
            q[ni-di] = q[ni-di] + addq
    i=i+1
    dant=d
#======================================================================================================================
#Escribo buffers
#======================================================================================================================
print('Escribiendo')
desde_hoy = (dia_ini - dia_ini).days*24*4
hasta_hoy = (hoy - dia_ini).days*24*4
c[0:hasta_hoy]=p[0:hasta_hoy]
c[hasta_hoy:int(2*hasta_hoy)]=q[0:hasta_hoy]
con=c[0:int(2*hasta_hoy)]
con.tofile(fichero)


