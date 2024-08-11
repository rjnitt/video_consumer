FROM ubuntu

RUN apt-get update && apt-get upgrade -y 
RUN  apt-get install -y ffmpeg npm

WORKDIR /home/app

COPY package*.json .
COPY index.js .


RUN npm install

CMD ["npm", "start"]


