FROM node:9  
EXPOSE 1338
COPY . .  
RUN [ "npm", "update" ]  
CMD [ "npm", "start" ]  