/**
 * jQuery Formset 1.3-pre
 * @author Stanislaus Madueke (stan DOT madueke AT gmail DOT com)
 * @requires jQuery 1.2.6 or later
 *
 * Copyright (c) 2009, Stanislaus Madueke
 * All rights reserved.
 *
 * Licensed under the New BSD License
 * See: http://www.opensource.org/licenses/bsd-license.php
 */

/**
 * Events
 *
 * initialized.formset -- Triggered when a formset is first initialized.
 * row_removed.formset -- Triggered when a row is removed. Receives the
 *                        removed row as an extra parameter if it's
 *                        hidden rather than destroyed.
 * row_added.formset   -- Triggered when a row is added. Receives the
 *                        new row as an extra parameter.
 */

;(function($) {
    "use strict";

    // Formset Class Definition
    // ========================

    var Formset = function (el, options) {
        this.options = $.extend({}, Formset.DEFAULTS, options);
        this.$el = $(el);
        this.totalForms = $('#id_' + options.prefix + '-TOTAL_FORMS');
        this.maxForms = $('#id_' + options.prefix + '-MAX_NUM_FORMS');

        this.init();
    };

    Formset.DEFAULTS = {
        prefix: 'form',                  // The form prefix for your django formset
        rowSelector: null,               // The jQuery selector to identify rows of the formset
        formTemplate: null,              // The jQuery selection cloned to generate new form instances
        addTrigger: '<a href="#">Add Another</a>',
        deleteTrigger: '<a href="#">Remove</a>',
        deleteWrapper: null,             // jQuery selector for which element delete button should be appended to
        addCssClass: 'add-row',          // CSS class applied to the add link
        addWrapper: null,                // jQuery selector for which element add button should be appended to
        deleteCssClass: 'delete-row',    // CSS class applied to the delete link
        formCssClass: 'dynamic-form',    // CSS class applied to each form in a formset
        keepFieldValues: '',             // jQuery selector for fields whose values should be kept when the form is cloned
        sortableHandle: null,            // jQuery selector for what part of each form row is draggable
        sortableField: null,             // Name of field which keeps track of order index
    };

    Formset.childElementSelector = 'input,select,textarea,label,div';

    Formset.log = function () {
        /*global console:true */
        if (window.console && console.log)
            console.log('[formset] ' + Array.prototype.join.call(arguments, ' ') );
    };

    Formset.prototype.init = function () {
        // Find all children of wrapper or all descendents matching options.rowSelector:
        var formset = this, // useful for subscope below
            options = this.options,
            initial_rows = this.current_rows();

        // Initialize each of the current rows:
        initial_rows.each(function () {
            var row = $(this),
                del = row.find('input:checkbox[id $= "-DELETE"]');
            if (del.length) {
                // If you specify "can_delete = True" when creating an inline formset,
                // Django adds a checkbox to each form in the formset.
                // Replace the default checkbox with a hidden field:
                if (del.is(':checked')) {
                    // If an inline formset containing deleted forms fails validation, make sure
                    // we keep the forms hidden (thanks for the bug report and suggested fix Mike)
                    del.before('<input type="hidden" name="' + del.attr('name') +'" id="' + del.attr('id') +'" value="on" />');
                    row.hide();
                } else {
                    del.before('<input type="hidden" name="' + del.attr('name') +'" id="' + del.attr('id') +'" />');
                }
                // Hide any labels associated with the DELETE checkbox:
                $('label[for="' + del.attr('id') + '"]').hide();
                del.remove();
            }
            row.addClass(options.formCssClass);
            if (row.is(':visible')) {
                formset.insertDeleteLink(row);
            }
        });

        this.insertAddLink();

        // If sortableHandle and sortableField are set, initialize sortables
        if (options.sortableHandle !== null && options.sortableField !== null) this.initSortable();

        // Trigger the initialized event:
        this.$el.trigger('initialized.formset');
        Formset.log("Initialized formset with " + initial_rows.length + " initial rows.");
    };

    Formset.prototype.initSortable = function () {
        // TODO: implement
    };

    Formset.prototype.current_rows = function () {
        var options = this.options;
        return (options.rowSelector === null) ? this.$el.children() : this.$el.find(options.rowSelector);
    };

    Formset.prototype.insertAddLink = function () {
        // Generate the add button:
        var formset = this, // useful for subscope below
            options = this.options,
            add_link = this.add_link = $(options.addTrigger),
            current_rows = this.current_rows(),
            hideAddButton = !this.showAddButton(),
                addButton, template;
            if (options.formTemplate) {
                // If a form template was specified, we'll clone it to generate new form instances:
                template = (options.formTemplate instanceof $) ? options.formTemplate : $(options.formTemplate);
                template.find(Formset.childElementSelector).each(function() {
                    formset.updateElementIndex($(this), options.prefix, '__prefix__');
                });
            } else {
                // Otherwise, use the last form in the formset; this works much better if you've got
                // extra (>= 1) forms (thnaks to justhamade for pointing this out):
                template = $('.' + options.formCssClass + ':last').clone(true).removeAttr('id');
                template.find('input:hidden[id $= "-DELETE"]').remove();
                // Clear all cloned fields, except those the user wants to keep (thanks to brunogola for the suggestion):
                template.find(Formset.childElementSelector).not(options.keepFieldValues).each(function() {
                    var elem = $(this);
                    // If this is a checkbox or radiobutton, uncheck it.
                    // This fixes Issue 1, reported by Wilson.Andrew.J:
                    if (elem.is('input:checkbox') || elem.is('input:radio')) {
                        elem.attr('checked', false);
                    } else {
                        elem.val('');
                    }
                });
            }
            // FIXME: Perhaps using $.data would be a better idea?
            options.formTemplate = template;

            // Generate the add button.
            if (options.addWrapper !== null) {
                // If a wrapper selector is specified, append the add
                // button to the element matching that selector.
                $(options.addWrapper).append(add_link);
            } else if (current_rows.attr('tagName') == 'TR') {
                // If forms are laid out as table rows, insert the
                // "add" button in a new table row:
                var numCols = current_rows.eq(0).children().length,   // This is a bit of an assumption :|
                    buttonRow = $('<tr><td colspan="' + numCols + '"></td></tr>').addClass(options.formCssClass + '-add');
                buttonRow.find('td').append(add_link)
                current_rows.parent().append(buttonRow);
                if (hideAddButton) buttonRow.hide();
            } else {
                // Otherwise, insert it immediately after the last form:
                current_rows.filter(':last').after(add_link);
                if (hideAddButton) add_link.hide();
            }
            add_link.click(function (e) {
                e.preventDefault();
                formset.addRow();
            });
    };

    Formset.prototype.insertDeleteLink = function (row) {
        var options = this.options,
            // Create a new DOM element:
            delete_link = $(options.deleteTrigger);
        // Store the associated row as data on the delete link:
        delete_link.data('formset.row', row);
        // Store the associated formset as data on the delete link:
        delete_link.data('formset', this);
        // Find the appropriate place to append the delete link:
        if (options.deleteWrapper !== null){
            // If a wrapper selector is specified, append to an
            // element matching that selector within the row:
            row.find(options.deleteWrapper).append(delete_link)
        } else if (row.is('tr')) {
            // If the forms are laid out in table rows, insert
            // the remove button into the last table cell:
            row.children(':last').append(delete_link);
        } else if (row.is('ul') || row.is('OL')) {
            // If they're laid out as an ordered/unordered list,
            // insert an <li> after the last list item:
            row.append(delete_link.wrap('<li></li>'));
        } else {
            // Otherwise, just insert the remove button as the
            // last child element of the form's container:
            row.append(delete_link);
        }
        // Bind the click event for the delete link:
        delete_link.click(function(e) {
            var $this = $(this),
                row = $this.data('formset.row'),
                formset = $this.data('formset');
            e.preventDefault()
            return formset.removeRow(row);
        });

        Formset.log("Added delete link to row.");
    };

    Formset.prototype.removeRow = function (row) {
        // Remove a row, with the row passed as a jQuery object.
        var formset = this, // useful for subscope below
            options = this.options,
            del = row.find('input:hidden[id $= "-DELETE"]'),
            buttonRow = $(this.add_link).parents('tr.' + options.formCssClass + '-add').get(0) ? $(this.add_link).parents('tr.' + options.formCssClass + '-add') : this.add_link,
            forms;
        if (del.length) {
            // We're dealing with an inline formset.
            // Rather than remove this form from the DOM, we'll mark it as deleted
            // and hide it, then let Django handle the deleting:
            del.val('on');
            row.hide();
            forms = $('.' + options.formCssClass).not(':hidden');
        } else {
            row.remove();
            // Update the TOTAL_FORMS count:
            forms = this.current_rows();
            this.totalForms.val(forms.length);
        }
        for (var i=0, formCount=this.current_rows().length; i<formCount; i++) {
            if (!del.length) {
                // Also update names and IDs for all child controls (if this isn't
                // a delete-able inline formset) so they remain in sequence:
                forms.eq(i).find(Formset.childElementSelector).each(function() {
                    formset.updateElementIndex($(this), i);
                });
            }
        }

        // Check if we need to show the add button:
        if (buttonRow.is(':hidden') && this.showAddButton()) buttonRow.show();

        // Trigger the row_removed event:
        this.$el.trigger('row_removed.formset', [row]);
        Formset.log("Removed a row.");

        return false;
    };

    Formset.prototype.addRow = function (row) {
        var formset = this, // useful for subscope below
            options = this.options,
            formCount = parseInt(this.totalForms.val()),
            row = options.formTemplate.clone(true).removeClass('formset-custom-template'),
            buttonRow = $(this.add_link).parents('tr.' + options.formCssClass + '-add').get(0) ? $(this.add_link).parents('tr.' + options.formCssClass + '-add') : null;
        if (buttonRow !== null) {
            // If this is a table, insert before the button row.
            row.insertBefore(buttonRow).show();
        } else {
            this.current_rows().filter(':last').after(row)
        }
        this.insertDeleteLink(row);
        row.find(Formset.childElementSelector).each(function() {
            formset.updateElementIndex($(this), formCount);
        });
        this.totalForms.val(formCount + 1);
        // Check if we've exceeded the maximum allowed number of forms:
        if (buttonRow !== null) {
            // If it's a table, hide the hold row:
            if (!this.showAddButton()) buttonRow.hide();
        } else {
            if (!this.showAddButton()) this.add_link.hide();
        }
        // If a post-add callback was supplied, call it with the added form:
        if (options.added) options.added(row);

        // Trigger the row_added event:
        this.$el.trigger('row_added.formset', [row]);
        Formset.log("Added a row. Current row count: " + this.totalForms.val() + ". Max row count: " + this.maxForms.val() + ".");

        return false;
    };

    Formset.prototype.showAddButton = function () {
        return this.maxForms.length == 0 ||   // For Django versions pre 1.2
            (this.maxForms.val() == '' || (this.maxForms.val() - this.totalForms.val() > 0))
    };

    Formset.prototype.updateElementIndex = function(elem, ndx) {
        var prefix = this.options.prefix,
            idRegex = new RegExp(prefix + '-(\\d+|__prefix__)-'),
            replacement = prefix + '-' + ndx + '-';
        if (elem.attr("for")) elem.attr("for", elem.attr("for").replace(idRegex, replacement));
        if (elem.attr('id')) elem.attr('id', elem.attr('id').replace(idRegex, replacement));
        if (elem.attr('name')) elem.attr('name', elem.attr('name').replace(idRegex, replacement));
    },

    // Plugin Definition
    // =================

    $.fn.formset = function (options) {
        // Should be called on an element that is a parent or ancestor
        // of the formset rows.
        return this.each(function () {
            var $this = $(this),
                data = $(this).data('formset'),
                options_ = typeof options == 'object' && options;
            // Instatiate formset on element if it not already.
            if (!data) return $this.data('formset', new Formset(this, options_));
            // If a string was passed to the function, interpret as an API command.
            if (typeof options_ == 'string') return data[option_]();
        });
    };

})(jQuery);