/**
 * AuthoritySuggester.js
 *
 * Widget that provides autocompletion for supported authority control properties
 * using external endpoints.
 *
 * Draws on code from jquery.wikibase.entitysuggester.js and jquery.wikibase.commonssuggester.js
 *
 * @author Dan Michael O. Heggø <danmichaelo@gmail.com>
 * @licence MIT
 */
( function ( mw, wb, $ ) {
	'use strict';

	var config = {
			url: 'https://tools.wmflabs.org/bsaut/authority.php?property=%PROPERTY%&value=%QUERY%',
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
	 * The authority record suggester widget.
	 *
	 * @class jQuery.ui.authoritysuggester
	 * @extends jQuery.ui.suggester
	 *
	 * @constructor
	 */
	$.widget( 'ui.authoritysuggester', $.ui.suggester, {

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

			console.log( '[authoritysuggester] Create suggester', this.options );

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
		 * Initializes the default source pointing to the authority search service
		 * for the given property.
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
		 * Generates the label for a suggester entity.
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
		 * Generate the URL to the authority record using the formatter URL (P1630) template.
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
					console.log( '[authoritysuggester] Select item:', item.getValue() );

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
	 * Add the authoritySuggester widget to a text input field.
	 *
	 * @param {jQuery} $input jQuery selector for the input field
	 * @param {string} property The property ID
	 */
	function addAuthoritySuggesterToInputField( $input, property ) {

		if ( !~config.supportedProperties.indexOf( property ) ) {
			return;
		}

		FormatterUrlService.get( property ).then( function ( url ) {
			$input.authoritysuggester( {
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
	 * Setup DOM observers so that we can be notified when the editing of a property starts
	 * and we need to initialize an autocomplete widget.
	 *
	 * Question: Is there a better way
	 */
	function setupDomObservers() {
		var observer, i, properties = [];

		observer = new MutationObserver( function ( mutations ) {
			mutations.forEach( function ( mutation ) {
				if ( mutation.type === 'childList' ) {
					mutation.addedNodes.forEach( function ( node ) {
						var $stmt,
							$node = $( node );

						if ( $node.hasClass( 'ui-entityselector-input' ) ) {
							$node.on( 'entityselectorselected', function ( evt, entityId ) {
								$stmt = $node.closest( '.wikibase-statementgroupview' );
								properties[ $stmt ] = entityId;
							} );
						}

						if ( $node.hasClass( 'valueview-expert-StringValue-input' ) ) {
							$stmt = $node.closest( '.wikibase-statementgroupview' );

							if ( $stmt.attr( 'id' ) ) {
								// Editing an existing statement
								addAuthoritySuggesterToInputField( $node, $stmt.attr( 'id' ) );
							} else if ( properties[ $stmt ] ) {
								// Creating a new statement
								addAuthoritySuggesterToInputField( $node, properties[ $stmt ] );
							}
						}
					} );
				}
			} );
		} );

		// Find elements with class .wikibase-statementgrouplistview
		for ( i = document.getElementsByClassName( 'wikibase-statementgrouplistview' ).length - 1; i >= 0; i-- ) {
			observer.observe(
				document.getElementsByClassName( 'wikibase-statementgrouplistview' )[ i ],
				{
					attributes: false,
					childList: true, // Observe additions and removals of direct child elements
					characterData: false,
					subtree: true // Also observe changes to target's descendants
				}
			);
		}
	}

	// Question: Do we need to wait for document.ready here, or is not needed?
	$( setupDomObservers.bind( this ) );

}( mediaWiki, wikibase, jQuery ) );
