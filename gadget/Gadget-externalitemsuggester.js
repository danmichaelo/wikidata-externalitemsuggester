/**
 * Gadget-externalitemsuggester.js
 *
 * Gadget that provides autocompletion for supported external-id properties on Wikidata
 * using external search services.
 *
 * Draws on code from jquery.wikibase.entitysuggester.js and jquery.wikibase.commonssuggester.js
 *
 * @author Dan Michael O. Heggø <danmichaelo@gmail.com>
 * @licence MIT
 */
( function ( mw, wb, $ ) {
	'use strict';

	var config = {
			url: 'https://tools.wmflabs.org/externalitemsuggester/search?property=%PROPERTY%&value=%QUERY%',
			supportedProperties: [
				'P214', // VIAF
				'P1015', // Bibsys
				'P1566' // GeoNames
			],
			timeout: 10000
		},
		api = new mw.Api(),
		repoApi = new wb.api.RepoApi( api );

	/**
	 * The external item suggester widget.
	 *
	 * @class jQuery.ui.externalitemsuggester
	 * @extends jQuery.ui.suggester
	 *
	 * @constructor
	 */
	$.widget( 'ui.externalitemsuggester', $.ui.suggester, {

		/**
		 * Caches retrieved results.
		 *
		 * @property {Object} [_cache={}]
		 * @protected
		 */
		_cache: null,

		/**
		 * @see jQuery.ui.suggester._create
		 */
		_create: function () {

			this._cache = {};

			console.log( '[externalitemsuggester] Create suggester', this.options );

			if ( !this.options.source ) {
				this.options.source = this._initDefaultSource();
			}
			$.ui.suggester.prototype._create.call( this );

			// Piggyback on the ui-entityselector-* classes (until we define our own?)
			this.element
				.addClass( 'ui-entityselector-input' )
				.prop( 'dir', $( document ).prop( 'dir' ) )
				.css( 'background', '#ffffaa' ); // Just for testing. Should be removed @TODO

			this.options.menu.element.addClass( 'ui-entityselector-list' );
		},

		/**
		 * @inheritdoc
		 * @protected
		 */
		destroy: function () {
			this._cache = {};
			this.element.removeClass( 'ui-entityselector-input' );
			$.ui.suggester.prototype.destroy.call( this );
		},

		/**
		 * Initializes the default source pointing to the external item search service.
		 *
		 * @protected
		 * @return {Function}
		 */
		_initDefaultSource: function () {
			var self = this;

			return function ( term ) {
				var deferred = $.Deferred(),
					url = config.url
						.replace( '%PROPERTY%', encodeURIComponent( self.options.property ) )
						.replace( '%QUERY%', encodeURIComponent( term ) );

				$.ajax( {
					url: url,
					dataType: 'json',
					xhrFields: {
						withCredentials: true
					},
					timeout: config.timeout || 10000
				} ).then(
					function ( response ) {
						if ( response.error ) {
							// Question: Could we throw new Error instead here?
							deferred.reject( response.error.info );
							return;
						}

						deferred.resolve(
							response.results,
							term,
							response.continuation
						);
					},
					function ( jqXHR, textStatus ) {
						deferred.reject( textStatus );
					}
				);

				return deferred.promise();
			};
		},

		/**
		 * @inheritdoc
		 * @protected
		 */
		_getSuggestions: function () {
			var self = this;

			return $.ui.suggester.prototype._getSuggestions.apply( this, arguments )
				.then( function ( suggestions, searchTerm, nextSuggestionOffset ) {
					var deferred = $.Deferred();

					if ( self._cache.term === searchTerm && self._cache.nextSuggestionOffset ) {
						self._cache.suggestions = self._cache.suggestions.concat( suggestions );
						self._cache.nextSuggestionOffset = nextSuggestionOffset;
					} else {
						self._cache = {
							term: searchTerm,
							suggestions: suggestions,
							nextSuggestionOffset: nextSuggestionOffset
						};
					}

					deferred.resolve( self._cache.suggestions, searchTerm );
					return deferred.promise();
				} );
		},

		/**
		 * Generate the menu element for a suggester entity.
		 *
		 * @param {Object} result
		 * @protected
		 * @return {jQuery}
		 */
		_createLabelFromSuggestion: function ( result ) {

			var $label = $( '<span>', { class: 'ui-entityselector-label' } ).text( result.label || result.id ),
				$description = $( '<span>', { class: 'ui-entityselector-description' } );

			if ( result.aliases ) {
				$label.append(
					$( '<span>', { class: 'ui-entityselector-aliases' } ).text( ' (' + result.aliases + ')' )
				);
			}

			if ( result.description && result.description.length ) {
				$description.text( result.description );
			}

			return $( '<span>', { class: 'ui-entityselector-itemcontent' } )
				.append( $label )
				.append( $description );
		},

		/**
		 * Generate URL to the external item using the formatter URL (P1630) template.
		 *
		 * @param {string} identifier
		 * @protected
		 * @return {string}
		 */
		_linkTo: function ( identifier ) {
			if ( this.options.urlFormat ) {
				return this.options.urlFormat.replace( '$1', identifier );
			}
		},

		/**
		 * @inheritdoc
		 * @protected
		 */
		_createMenuItemFromSuggestion: function ( suggestion ) {
			var $label = this._createLabelFromSuggestion( suggestion ),
				value = suggestion.id,
				link = this._linkTo( suggestion.id );

			return new $.ui.ooMenu.Item( $label, value, link );
		},

		/**
		 * @inheritdoc
		 * @protected
		 */
		_initMenu: function ( ooMenu ) {
			var self = this,
				customItems = ooMenu.option( 'customItems' );

			$.ui.suggester.prototype._initMenu.apply( this, arguments );

			$( this.options.menu )
				.on( 'selected.suggester', function ( event, item ) {
					console.log( '[externalitemsuggester] Select item:', item.getValue() );

					// The superclass (jquery.ui.suggester) already updates the textfield,
					// but does not update the view model, so we need to somehow notify the
					// view about the change (Otherwise, the correct value will not be saved
					// when the statement is saved).
					// Solution: By triggering the 'eachchange' event, the expert in
					// StringValue.js will notify the view about the change.
					self.element.trigger( 'eachchange' );
				} );

			// TODO: Add 'More..' element
			//
			// customItems.unshift( new $.ui.ooMenu.CustomItem(
			//     self.options.messages.more,
			//     function () {
			//         return self._cache.term === self._term && self._cache.nextSuggestionOffset;
			//     },
			//     function () {
			//         self.search( $.Event( 'programmatic' ) );
			//     },
			//     'ui-entityselector-more'
			// ) );

			// Add "Not found" menu item
			customItems.unshift( new $.ui.ooMenu.CustomItem(
				self.options.messages.notfound,
				function () {
					return self._cache.suggestions && !self._cache.suggestions.length && self.element.val().trim() !== '';
				},
				null,
				'ui-entityselector-notfound'
			) );

			ooMenu._evaluateVisibility = function ( customItem ) {
				if ( customItem instanceof $.ui.ooMenu.CustomItem ) {
					return customItem.getVisibility( ooMenu );
				} else {
					return ooMenu._evaluateVisibility.apply( this, arguments );
				}
			};

			ooMenu.option( 'customItems', customItems );

			return ooMenu;
		}

	} );

	// --------------------------------------------------------------------------------------------

	var FormatterUrlService = ( function () {
		var cache = {};

		/**
		 * Given a Wikidata property, find the formatter URL (P1630).
		 *
		 * @param {string} entityId The property ID (example: 'P1018')
		 * @return {Object} Promise that returns the formatter URL.
		 */
		function get( entityId ) {
			// First check if we have it in our local cache
			if ( cache[ entityId ] ) {

				// Question: Can we start using ES6 promises, or should we stick we jQuery ones?
				var deferred = $.Deferred();
				deferred.resolve( cache[ entityId ] );

				return deferred.promise();
			}

			// If not, then look it up using the api and add it to cache
			return repoApi.getEntities( entityId, 'claims' ).then( function ( data ) {
				var url = data.entities[ entityId ].claims.P1630[ 0 ].mainsnak.datavalue.value;
				cache[ entityId ] = url;
				return url;
			} );
		}

		return {
			get: get
		};
	}() );

	// --------------------------------------------------------------------------------------------

	/**
	 * Add the externalitemsuggester widget to a text input field.
	 *
	 * @param {jQuery} $input jQuery selector for the text input field
	 * @param {string} property The property ID
	 */
	function createSuggester( $input, property ) {
		FormatterUrlService.get( property ).then( function ( url ) {
			$input.externalitemsuggester( {
				property: property,
				urlFormat: url,
				messages: {
					more: mw.msg( 'wikibase-entityselector-more' ),
					notfound: mw.msg( 'wikibase-entityselector-notfound' )
				}
			} );

			// Remove focus from the original text field
			$input.off( 'blur' );
		} );
	}

	/**
	 * Initialize the gadget.
	 */
	function initGadget() {
		var properties = {};

		/**
		 * When a property has been selected from the dropdown menu for new statements,
		 * we take note of which property was selected.
		 *
		 * @param {jQuery} event The event
		 */
		$( '.wikibase-statementgrouplistview', this ).on( 'entityselectorselected',
			function onEntitySelectorSelected( event, propertyId ) {
				var $statement = $( event.target ).closest( '.wikibase-statementgroupview' );
				properties[ $statement ] = propertyId;
			}
		);

		$( '.wikibase-statementgrouplistview', this ).on( 'valueviewafterstartediting',
			/**
			 * When a new or existing statement of type StringValue is being edited, attach the
			 * autocomplete widget. New statements will not have an 'id' attribute, so we need to
			 * use the value we gathered from the `entityselectorselected` event above.
			 *
			 * @param {jQuery} event The event
			 */
			function onValueViewAfterStartEditing( event ) {
				var $statement = $( event.target ).closest( '.wikibase-statementgroupview' ),
					$input = $statement.find( '.valueview-expert-StringValue-input' ),
					property = properties[ $statement ] || $statement.attr( 'id' );

				if ( !$input.length ) {
					return; // Not a StringValue statement
				}

				if ( !~config.supportedProperties.indexOf( property ) ) {
					return; // Not a supported property
				}

				// Add the autocomplete widget
				createSuggester( $input, property );
			}
		);
	}

	(function() {

		// Question: Is all of this really necessary??
		var rendered = $.Deferred();

		$.when(
			rendered,
			$.ready
		).then( function () {
			initGadget();
		} );

		mw.hook( 'wikibase.entityPage.entityView.rendered' ).add( function () {
			rendered.resolve();
		} );
	})();

}( mediaWiki, wikibase, jQuery ) );
