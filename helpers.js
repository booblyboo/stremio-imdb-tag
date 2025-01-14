
// support extended types too, they are in a lot of lists
// although we probably will never use them
var extendedTypes = ['tv short', 'tv special', 'tv movie', 'video']

var helpers = {

	imdb: {

		sorts: {
			'Popular': 'moviemeter,asc',
			'New': 'release_date,desc',
			'Rating': 'user_rating,desc',
			'Alphabetical': 'alpha,asc',
			'Votes': 'num_votes,desc',
			'Longest': 'runtime,desc',
			'Shortest': 'runtime,asc',
			'Year Descending': 'year,desc',
			'Year Ascending': 'year,asc'
		},

		toId: function(href) {
		    var matches = href.match(/\/title\/(tt\d+)\//i)
		    return matches && matches.length > 1 ? matches[1] : false
		}
	},

	toString: function(str) {
	    return str && str.length ? str.text().trim() : false
	},

	toYear: function(str) {
		if (str) {
			var onlyDigits = str.replace(/[^0-9\.]/g, '')
			if (onlyDigits.length > 4)
				onlyDigits = onlyDigits.substr(0,4)
		    return onlyDigits
		} else
			return false
	},

	toType: function(str) {
	    if (str) {
	    	let type

	    	extendedTypes.some(function(extType) {
	    		if (str.toLowerCase().includes(extType)) {
	    			type = extType
	    			return true
	    		}
	    	})

	    	if (type) // it's one of the documented extended types
	    		return false

	    	// check if year has a line, in which case it's definitely a series
	    	var matches = str.match(/\((\d+–)/i)
			if (matches && matches.length > 1) {
	            return 'series'
	        } else {
	        	// otherwise, it can't be anything else except a movie
	            return 'movie'
	        }
	    } else
	        return false
	},

	toTitleCase: function(str) {
		return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
	},

	simplerText: function(str) {
	    return str ? str.toLowerCase().split(' ').join('_') : false
	},

	imageResize: function(posterUrl, width) {
		if (!posterUrl) return null
		if (!posterUrl.includes('amazon.com') && !posterUrl.includes('imdb.com')) return posterUrl
		if (posterUrl.includes('._V1_.')) posterUrl = posterUrl.replace('._V1_.', '._V1_SX' + width + '.')
		else if (posterUrl.includes('._V1_')) {
			var extension = posterUrl.split('.').pop()
			posterUrl = posterUrl.substr(0,posterUrl.indexOf('._V1_')) + '._V1_SX' + width + '.' + extension
		}
		return posterUrl
	},

	sortsTitleMap: {
		'Popular': 'by Popularity',
		'New': 'by Newest',
		'Votes': 'by Nr of Votes',
	}
}

module.exports = helpers
