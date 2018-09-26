FROM node:8 
EXPOSE 1338
COPY . .  
RUN [ "npm", "update" ]  
CMD [ "npm", "start" ] 
