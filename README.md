Hypermedia API
==============

This set of libraries will assist with the interaction of a web-based API that uses a combination of [REST], [JSON Schema], [XML] and [HAL] to provide a complete solution that makes simpler and more descriptive interfaces for services.

[REST]: http://en.wikipedia.org/wiki/Representational_state_transfer
[JSON Schema]: http://json-schema.org/
[XML]: http://en.wikipedia.org/wiki/XML
[HAL]: http://stateless.co/hal_specification.html

Key Principles
--------------

* The RESTful service is Level 3.  This means the URIs all point to resources or sub-resources, we care and use the HTTP verbs, and the entire API is discoverable and as self-documenting as possible.

* Use existing standards when possible and when they don't hinder development.

Why Use This
------------

There's a dumb client that is shipped with the code that can be used to point to the sample API that would walk you through a workflow.  The forms and client-side validation are all done on the fly by the library.  You could design custom interfaces to pretty things up if needed, but the basic functionality should all be there, ready for you to use in order to debug your services.

The architecture works for single page submissions as well as workflows that are lengthy and complicated.  Whether the user is walking through the checkout procedure of your website or if you just need a simple way to validate that the right information was submitted, this project should be of great interest.

Further Reading
---------------

The gory technical design choices are covered in various files under the `doc/` folder.

License
-------

Everything is licensed under a MIT license with a non-advertising clause.  The full license text is in the `doc/License.md` file.