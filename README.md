Widget that adds entityselector-like autocomplete for external entities just like local entities.

To help with disambiguating similar entities, it should be possible to ctrl/command-click the entity to
open it in a new tab, using the formatter URL (P1018)

Right now we have hard-coded a list of properties that we support.
For unsupported properties of datatype 'external-id' it would be nice if we could show a small message
"No autocomplete service for this property. Do you know one?"

Using `jquery.ui.suggester`, which is not actually part of jQuery UI,
but of the ValueView (`wikibase-data-values-value-view`) package.

setupDomObservers creates MutationObserver that we can be notified when the editing of a property starts.
Is there a better way? Tried listening to `statementviewafterstartediting`, but it triggers right
after a new statement is created, at a point where we don't yet know which property we are editing!
How about `valueviewafterstartediting` (Triggered after edit mode has been started and rendered.). That one is triggered after property has been selected.

- [ ] Create help page draft
- [ ] Gadget description: should link to help page for information about currently supported properties
      "Add autocompletion for external IDs for authority registers that provide search. See the help page for a list of supported services."

- [ ] Should `*.wmflabs.org` be added to Content Security Policy?
- [ ] Figure out why the autocomplete suggestion is not saved, but rather the typed text.
- [ ] Is there a way to make it testable?
- [ ] Is there a way to integrate it better?
