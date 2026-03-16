const fetch = require("node-fetch")

const API = "https://wiki.dominionstrategy.com/api.php"

async function getCard(cardName) {

    const params = new URLSearchParams({
        action: "parse",
        page: cardName,
        prop: "text|images",
        format: "json"
    })

    const url = `${API}?${params}`

    const res = await fetch(url)
    const data = await res.json()

    if (!data.parse) {
        console.log("Card not found")
        return
    }

    const html = data.parse.text["*"]

    console.log("Card:", cardName)
    console.log("Images:", data.parse.images)

    // quick image guess (usually the card image)
    const cardImage = data.parse.images.find(img =>
        img.toLowerCase().includes(cardName.toLowerCase())
    )

    if (cardImage) {
        const imageUrl =
            "https://wiki.dominionstrategy.com/images/" +
            cardImage.replace(/ /g, "_")

        console.log("Likely card image:", imageUrl)
    }

    console.log("\nHTML snippet:")
    console.log(html.substring(0, 500))
}

getCard("Farm")
```
