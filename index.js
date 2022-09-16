const { uploadMetadata, uploadImage, upload } = require('./libs/pinata')
const express = require('express')
const cors = require('cors')
const axios = require('axios')
const fs = require('fs')
const hre = require("hardhat")
const { ethers } = require("ethers")
const { getAccount, getContract } = require("./scripts/helpers")

require('dotenv').config()

const app = new express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

const tmpDir = './tmp'

app.post('/mint', async (req, res) => {
    const imagePath = 'images'
    const streamDir = `${tmpDir}/${req.body.id}/`
    const streamDirImages = streamDir + '/images'
    const streamDirMetadata = streamDir + '/meta'
    if (!fs.existsSync(streamDir)) { fs.mkdirSync(streamDir) }
    if (!fs.existsSync(streamDirImages)) { fs.mkdirSync(streamDirImages) }
    if (!fs.existsSync(streamDirMetadata)) { fs.mkdirSync(streamDirMetadata) }
    let imagesIPFS = []
    for (i in req.body.images) {
        const c = Number(i) + 1
        const imageObj = req.body.images[i]
        const imageBase = req.body.images[i].base
        const base64Data = imageBase.replace(/^data:image\/png;base64,/, "")
        const imageFile = `${streamDirImages}/${c}.png`
        fs.writeFileSync(imageFile, base64Data, 'base64', function (err) { console.log(err) })
        const imageIPFS = await uploadImage(imageFile)
        delete imageObj.base
        imageObj.image = imageIPFS.url
        imagesIPFS.push(imageObj)
    }
    //MAKE METADATA
    for (i in imagesIPFS) {
        const c = Number(i) + 1
        const imageObj = imagesIPFS[i]
        fs.writeFileSync(`${streamDirMetadata}/${c}`, JSON.stringify(imageObj), (error) => { if (error) throw error; })
    }
    const uploadMeta = await upload(streamDirMetadata)
    const uploadMetaUrl = uploadMeta.url
    // const uploadMetaUrl = 'https://gateway.pinata.cloud/ipfs/QmRrwikEa5EwY6xf9guCMdf8v2BjwVFYfW7fvUQSpqGo4a'

    console.log(uploadMetaUrl)
    let result = {}
    console.log('deploy NFT collection contract')
    const nftContractFactory = await hre.ethers.getContractFactory("NFT", getAccount())
    const nft = await nftContractFactory.deploy()
    await nft.deployed()
    const nftAddress = nft.address
    result.nftAddress = nftAddress
    console.log(`Contract deployed to address: ${nftAddress}`)

    console.log('setBaseTokenURI')
    const contract = await getContract("NFT", hre, nftAddress);
    const transactionResponse1 = await contract.setBaseTokenURI(uploadMetaUrl, {
        gasLimit: 500_000,
    });
    await transactionResponse1.wait()
    console.log(`Transaction Hash: ${transactionResponse1.hash}`);
    console.log(process.env.SERVICE_ADDRESS)
    for (i in imagesIPFS) {
        const transactionResponse = await contract.mintTo(process.env.SERVICE_ADDRESS, {
            gasLimit: 500_000,
            value: ethers.utils.parseEther("0.01")
        });
        await transactionResponse.wait()
        console.log(`Transaction Hash of ${i}: ${transactionResponse.hash}`);
    }
    result.success = true
    return res.status(200).send(result)
})

let port = process.env.PORT || 50001

app.listen(port, async function () {
    console.log('Service started')
    // axios.post(`http://localhost:${port}/mint`, {
    //     id: 123,
    //     images: [
    //         {
    //             name: 'x',
    //             description: 'x',
    //             external_url: 'x',
    //             base: 'iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAApgAAAKYB3X3/OAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAANCSURBVEiJtZZPbBtFFMZ/M7ubXdtdb1xSFyeilBapySVU8h8OoFaooFSqiihIVIpQBKci6KEg9Q6H9kovIHoCIVQJJCKE1ENFjnAgcaSGC6rEnxBwA04Tx43t2FnvDAfjkNibxgHxnWb2e/u992bee7tCa00YFsffekFY+nUzFtjW0LrvjRXrCDIAaPLlW0nHL0SsZtVoaF98mLrx3pdhOqLtYPHChahZcYYO7KvPFxvRl5XPp1sN3adWiD1ZAqD6XYK1b/dvE5IWryTt2udLFedwc1+9kLp+vbbpoDh+6TklxBeAi9TL0taeWpdmZzQDry0AcO+jQ12RyohqqoYoo8RDwJrU+qXkjWtfi8Xxt58BdQuwQs9qC/afLwCw8tnQbqYAPsgxE1S6F3EAIXux2oQFKm0ihMsOF71dHYx+f3NND68ghCu1YIoePPQN1pGRABkJ6Bus96CutRZMydTl+TvuiRW1m3n0eDl0vRPcEysqdXn+jsQPsrHMquGeXEaY4Yk4wxWcY5V/9scqOMOVUFthatyTy8QyqwZ+kDURKoMWxNKr2EeqVKcTNOajqKoBgOE28U4tdQl5p5bwCw7BWquaZSzAPlwjlithJtp3pTImSqQRrb2Z8PHGigD4RZuNX6JYj6wj7O4TFLbCO/Mn/m8R+h6rYSUb3ekokRY6f/YukArN979jcW+V/S8g0eT/N3VN3kTqWbQ428m9/8k0P/1aIhF36PccEl6EhOcAUCrXKZXXWS3XKd2vc/TRBG9O5ELC17MmWubD2nKhUKZa26Ba2+D3P+4/MNCFwg59oWVeYhkzgN/JDR8deKBoD7Y+ljEjGZ0sosXVTvbc6RHirr2reNy1OXd6pJsQ+gqjk8VWFYmHrwBzW/n+uMPFiRwHB2I7ih8ciHFxIkd/3Omk5tCDV1t+2nNu5sxxpDFNx+huNhVT3/zMDz8usXC3ddaHBj1GHj/As08fwTS7Kt1HBTmyN29vdwAw+/wbwLVOJ3uAD1wi/dUH7Qei66PfyuRj4Ik9is+hglfbkbfR3cnZm7chlUWLdwmprtCohX4HUtlOcQjLYCu+fzGJH2QRKvP3UNz8bWk1qMxjGTOMThZ3kvgLI5AzFfo379UAAAAASUVORK5CYII='
    //         },
    //         {
    //             name: 'x',
    //             description: 'x',
    //             url: 'x',
    //             base: 'iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAApgAAAKYB3X3/OAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAANCSURBVEiJtZZPbBtFFMZ/M7ubXdtdb1xSFyeilBapySVU8h8OoFaooFSqiihIVIpQBKci6KEg9Q6H9kovIHoCIVQJJCKE1ENFjnAgcaSGC6rEnxBwA04Tx43t2FnvDAfjkNibxgHxnWb2e/u992bee7tCa00YFsffekFY+nUzFtjW0LrvjRXrCDIAaPLlW0nHL0SsZtVoaF98mLrx3pdhOqLtYPHChahZcYYO7KvPFxvRl5XPp1sN3adWiD1ZAqD6XYK1b/dvE5IWryTt2udLFedwc1+9kLp+vbbpoDh+6TklxBeAi9TL0taeWpdmZzQDry0AcO+jQ12RyohqqoYoo8RDwJrU+qXkjWtfi8Xxt58BdQuwQs9qC/afLwCw8tnQbqYAPsgxE1S6F3EAIXux2oQFKm0ihMsOF71dHYx+f3NND68ghCu1YIoePPQN1pGRABkJ6Bus96CutRZMydTl+TvuiRW1m3n0eDl0vRPcEysqdXn+jsQPsrHMquGeXEaY4Yk4wxWcY5V/9scqOMOVUFthatyTy8QyqwZ+kDURKoMWxNKr2EeqVKcTNOajqKoBgOE28U4tdQl5p5bwCw7BWquaZSzAPlwjlithJtp3pTImSqQRrb2Z8PHGigD4RZuNX6JYj6wj7O4TFLbCO/Mn/m8R+h6rYSUb3ekokRY6f/YukArN979jcW+V/S8g0eT/N3VN3kTqWbQ428m9/8k0P/1aIhF36PccEl6EhOcAUCrXKZXXWS3XKd2vc/TRBG9O5ELC17MmWubD2nKhUKZa26Ba2+D3P+4/MNCFwg59oWVeYhkzgN/JDR8deKBoD7Y+ljEjGZ0sosXVTvbc6RHirr2reNy1OXd6pJsQ+gqjk8VWFYmHrwBzW/n+uMPFiRwHB2I7ih8ciHFxIkd/3Omk5tCDV1t+2nNu5sxxpDFNx+huNhVT3/zMDz8usXC3ddaHBj1GHj/As08fwTS7Kt1HBTmyN29vdwAw+/wbwLVOJ3uAD1wi/dUH7Qei66PfyuRj4Ik9is+hglfbkbfR3cnZm7chlUWLdwmprtCohX4HUtlOcQjLYCu+fzGJH2QRKvP3UNz8bWk1qMxjGTOMThZ3kvgLI5AzFfo379UAAAAASUVORK5CYII='
    //         }

    //     ]
    // })
})