
const helpers = require('./helpers')
const cheerio = require('cheerio')

const { config } = require('internal')

const { addonBuilder, getRouter } = require('stremio-addon-sdk')

const manifest = {
	id: 'org.imdbtag_local',
	version: '0.0.1',
	name: 'IMDB Tag Add-on',
	description: 'Add-on to create a catalog from a IMDB tag based on a link from IMDB.',
	resources: ['catalog'],
	types: ['movie', 'series'],
	catalogs: [
		{
			id: 'imdb-movie-tag',
			name: 'IMDB Movie Tag List',
			type: 'movie'
		}, {
			id: 'imdb-series-tag',
			name: 'IMDB Series Tag List',
			type: 'series'
		}
	]
}

const needle = require('needle')

const headers = {
	'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
	'Accept-Language': 'en-US,en;q=0.8',
}

function parseHeaderData(header) {
    if (header) {

        var link = header.find('a')

        if (link && link.length) {
            var name = helpers.toString(link)
            var href = link.attr('href')
        }

        var year = helpers.toString(header.find('span').eq(1))

        var type = helpers.toType(year)

        year = helpers.toYear(year)

        var imdbId = href ? helpers.imdb.toId(href) : false

        return { id: imdbId, name, year, type }

    } else {
        return {}
    }
}

function getList(tagId, sort, page, cb) {
	if (tagId) {
		headers.referer = 'https://www.imdb.com/search/keyword?keywords='+tagId
		const getUrl = 'https://www.imdb.com/search/keyword/_ajax?keywords='+tagId+'&sort='+helpers.imdb.sorts[sort]+'&mode=detail&page=' + page
		needle.get(getUrl, { headers }, (err, resp) => {
			if (!err && resp && resp.body) {

				const results = { movie: [], series: [] }

				const cacheTag = helpers.simplerText(tagId) + '[]' + sort

				if (page == 1) {
					cache[cacheTag] = { movie: [], series: [] }
				}

				const $ = cheerio.load(resp.body)

				$('.lister-item').each((ij, el) => {

					var resp = parseHeaderData($(el).find('.lister-item-header'))

					var imgElm = $(el).find('img')

					resp.poster = imgElm && imgElm.length ? helpers.imageResize(imgElm.attr('loadlate'), 250) : false

					var isReleased = !$(el).find('.lister-item-content').find('p.text-muted.text-small').eq(0).has('b').length

					// we only add items that have already been released
					if (isReleased && resp.type && results[resp.type])
						results[resp.type].push(resp)

				})

				if (results.movie.length || results.series.length) {
					cache[cacheTag].movie = cache[cacheTag].movie.concat(results.movie)
					cache[cacheTag].series = cache[cacheTag].series.concat(results.series)
					// parse only 2 pages
					if (page < 2) {
						page++
						getList(tagId, sort, page, cb)
						return
					}
				}
				if (cache[cacheTag].movie.length || cache[cacheTag].series.length) {
					// remove cache weekly
					setTimeout(() => {
						manifest.types.forEach(el => { delete cache[cacheTag] })
					}, 604800000)
					cb(false, true)
				} else
					cb('No results for this tag')
			} else
				cb(err || 'Error on requesting ajax call')
		})
	} else
		cb('No list id')
}

const namedQueue = require('named-queue')

const queue = new namedQueue((task, cb) => {
	const id = task.id.split('[]')[0]
	const sort = task.id.split('[]')[1]
	getList(id, sort, 1, cb)
}, Infinity)

const cache = { movie: {}, series: {} }

function retrieveManifest() {
	const cacheTag = helpers.simplerText(tagId) + '[]' + (config.sort)
	const cloneManifest = JSON.parse(JSON.stringify(manifest))
	cloneManifest.id += cacheTag
	cloneManifest.name = helpers.toTitleCase(tagId) + ' ' + (helpers.sortsTitleMap[config.sort] || ('by ' + config.sort))
	cloneManifest.catalogs.forEach((cat, ij) => {
		cloneManifest.catalogs[ij].id += '-'+cacheTag
		cloneManifest.catalogs[ij].name = helpers.toTitleCase(tagId) + ' ' + (cat.type == 'movie' ? 'Movies' : 'Series') + ' ' + (helpers.sortsTitleMap[config.sort] || ('by ' + config.sort))
	})
    return cloneManifest
}

let tagId = ''

async function retrieveRouter() {
	return new Promise((resolve, reject) => {
		if (!config.tagUrl) {
			reject(Error('IMDB Tag Add-on - No Tag Url'))
			return
		} else {
			if (!config.tagUrl.includes('.imdb.com/search/keyword?keywords=')) {
				// https://www.imdb.com/search/keyword?keywords=hero&...
				reject(Error('IMDB Tag Add-on - Invalid IMDB Tag URL, it should be in the form of: https://www.imdb.com/search/keyword?keywords=hero&...'))
				return
			} else {
				let tempId = config.tagUrl.split('?keywords=')[1]
				if (tempId.includes('&'))
					tempId = tempId.split('&')[0]
				tagId = tempId
			}
		}
		const manifest = retrieveManifest()
		const builder = new addonBuilder(manifest)
		builder.defineCatalogHandler(args => {
			return new Promise((resolve, reject) => {
				const cacheTag = helpers.simplerText(tagId) + '[]' + config.sort
				function fetch() {
					queue.push({ id: tagId + '[]' + config.sort }, (err, done) => {
						if (done) {
							const userData = cache[cacheTag][args.type]
							resolve({ metas: userData, cacheMaxAge: 604800 }) // one week
						} else 
							reject(err || Error('Could not get list items'))
					})
				}
				if (tagId && ['movie','series'].indexOf(args.type) > -1) {
					if (cache[cacheTag] && cache[cacheTag][args.type]) {
						const userData = cache[cacheTag][args.type]
						if (userData.length)
							resolve({ metas: userData, cacheMaxAge: 604800 }) // one week
						else
							fetch()
					} else
						fetch()
				} else
					reject(Error('Unknown request parameters'))
			})
		})

		resolve(getRouter(builder.getInterface()))
	})
}

module.exports = retrieveRouter()
