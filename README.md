Hypermedia API Employing REST
=============================

This set of libraries will assist with the interaction of a web-based API that utilizes [JSON Schema]'s Hyper-Schema.  The hyper-schema provides a complete solution for simpler and more descriptive interfaces for services.  This project builds an API communications layer for a client and includes a "dumb" client that can navigate any API.  It's taking [REST] to a whole new level.

[JSON Schema]: http://json-schema.org/
[REST]: http://en.wikipedia.org/wiki/Representational_state_transfer

Key Principles
--------------

* The RESTful service is Level 3.  This means the URIs all point to resources or sub-resources, we care and use the HTTP verbs, and the entire API is discoverable and as self-documenting as possible.  You'll really appreciate "just getting it" when you manually browse an API.

* Use existing standards when possible and when they don't hinder development.  For instance, we use some non-IANA approved rel's for our links, but they are somewhat commonly found on the web and people can just understand what they mean and should automatically know what to do with them.

Why Use This
------------

There's a dumb client that is shipped with the code that can be used to point to the sample API that would walk you through a workflow.  The forms and client-side validation are all done on the fly by the library.  You could design custom interfaces to pretty things up if needed, but the basic functionality should all be there, ready for you to use in order to debug your services.

This dumb client's architecture is made in such a way that you can use it to build your own, immensely intelligent client.  I'm providing just the building blocks.  It should be easy to tie them into your code and use an API with nearly any existing framework.

The architecture works for single page submissions as well as workflows that are lengthy and complicated.  Whether the user is walking through the checkout procedure of your website or if you just need a simple way to validate that the right information was submitted, this project should be of great interest.

Technical Notes
---------------

The code all assumes EcmaScript 5, which is why `es5-shim.js` should be used with browsers that do not yet comply with that standard.

Further Reading
---------------

The gory technical design choices are covered in various files under the `doc/` folder.

License
-------

Everything is licensed under a MIT license with a non-advertising clause.  The full license text is in the `doc/License.md` file.
