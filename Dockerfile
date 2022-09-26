FROM node:16

WORKDIR /srv

COPY ./ ./
RUN npm i
RUN npx hardhat compile

EXPOSE 3000

CMD node index.js
