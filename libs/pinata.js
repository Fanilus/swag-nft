require('dotenv').config();
const key = process.env.PINATA_KEY;
const secret = process.env.PINATA_SECRET
const jwt = process.env.JWT
const ipfsUrl = process.env.IPFS_URL

const fs = require("fs");
const FormData = require("form-data")
const rfs = require("recursive-fs")
const basePathConverter = require("base-path-converter")

const axios = require('axios')

const uploadMetadata = async (JSONBody) => {
    const url = `https://api.pinata.cloud/pinning/pinJSONToIPFS`;
    return axios
        .post(url, JSONBody, {
            headers: {
                pinata_api_key: key,
                pinata_secret_api_key: secret,
            }
        })
        .then(function (response) {
            return {
                success: true,
                pinataUrl: ipfsUrl + response.data.IpfsHash
            };
        })
        .catch(function (error) {
            console.log(error)
            return {
                success: false,
                message: error.message,
            }

        });
}
const uploadImage = async (imagePath) => {
    const data = new FormData();
    data.append('file', fs.createReadStream(imagePath));
    data.append('pinataOptions', '{"cidVersion": 1}');
    data.append('pinataMetadata', '{"name": "Swag", "keyvalues": {"company": "Swag"}}');

    const config = {
        method: 'post',
        url: 'https://api.pinata.cloud/pinning/pinFileToIPFS',
        headers: {
            pinata_api_key: key,
            pinata_secret_api_key: secret,
            ...data.getHeaders()
        },
        data: data
    }

    try {
        const result = await axios(config)
        return {
            success: true,
            url: ipfsUrl + result.data.IpfsHash
        };
    } catch (error) {
        return {
            success: false,
            message: error,
        }
    }
};

const upload = async (src) => {


    const { dirs, files } = await rfs.read(src);
    let data = new FormData();
    for (const file of files) {
        data.append(`file`, fs.createReadStream(file), {
            filepath: basePathConverter(src, file),
        });
    }
    const config = {
        method: 'post',
        url: 'https://api.pinata.cloud/pinning/pinFileToIPFS',
        headers: {
            "Content-Type": `multipart/form-data; boundary=${data._boundary}`,
            pinata_api_key: key,
            pinata_secret_api_key: secret,
            ...data.getHeaders()
        },
        data: data
    }
    try {
        const result = await axios(config)
        return {
            success: true,
            url: ipfsUrl + result.data.IpfsHash
        };
    } catch (error) {
        return {
            success: false,
            message: error,
        }
    }
};
module.exports = {
    uploadMetadata,
    uploadImage,
    upload
}