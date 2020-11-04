/*
 * Copyright (c) [2020] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import cockpit from 'cockpit';

/**
 * Converts a HTML element to a plain object
 *
 * @function
 *
 * @param {HTMLElement} element - Element to convert to JSON
 * @param {Array<string>} listElement - Special elements to be considered lists
 * @return {Object} Plain object representing the element (and its children)
 *
 * @ignore
 */
const elementToJson = (element, listElements) => {
    const children = Array.from(element.children);
    const key = element.localName.replace(/-/g, '_');

    if (children.length === 0) {
        return { [key]: element.textContent };
    } else {
        let value = children.map(e => elementToJson(e, listElements));

        if (listElements.includes(key)) {
            value = value.map(v => Object.values(v)[0]);
        } else {
            value = value.reduce((all, child) => ({ ...all, ...child }), {});
        }

        const attrs = elementAttributes(element);
        if (Object.keys(attrs).length > 0) value = { ...value, _attrs: attrs };

        return { [key]: value };
    }
};

const elementAttributes = (element) => {
    return Array.from(element.attributes).reduce((all, attr) => (
        { ...all, [attr.nodeName]: attr.nodeValue }
    ), {});
};

/* @ignore */
const emptyTagsRegExp = new RegExp(/<\w+\/>/, 'g');

/**
 * Sanitize the XML string before it gets processed
 *
 * Removes empty tags, as they will cause troubles when parsing.
 *
 * @param {string} xmlString - XML string to sanitize
 */
const sanitizeXml = (xmlString) => {
    return xmlString.replace(emptyTagsRegExp, '');
};

/**
 * Returns a plain object representing the given string
 *
 * @todo Unfortunately, the XML generated by Wicked is not valid. So the string
 * is parsed as HTML and some additional tweak is needed (@see sanitizeXml).
 *
 * @param {string} xmlString - XML string to convert to JSON
 * @param {Array<string>} listElements - Special elements to be considered lists
 * @return {Object} Plain object representing the given XML
 *
 * @ignore
 */
const XmlToJson = (xmlString, listElements = []) => {
    const parser = new DOMParser();
    const dom = parser.parseFromString(sanitizeXml(xmlString), 'text/html');
    const [body] = dom.getElementsByTagName('body');
    const result = elementToJson(body, listElements);
    return result.body;
};

/**
 * Class to interact with Wicked.
 *
 * @class
 *
 * This class is responsible for communicating with Wicked using its CLI and
 * parsing the XML output.
 */
class WickedClient {
    /**
     * Returns a promise that resolves to an array of objects representing interfaces
     *
     * @return {Promise.<Array.<Object>>} Promise that resolves to a list of interfaces
     */
    async getInterfaces() {
        const stdout = await cockpit.spawn(['/usr/sbin/wicked', 'show-xml']);
        return XmlToJson(stdout, ['body']);
    }

    /**
     * Returns a promise that resolves to an array of objects representing configurations
     *
     * @return {Promise.<Array.<Object>>} Promise that resolves to a list of interfaces
     */
    async getConfigurations() {
        const stdout = await cockpit.spawn(['/usr/sbin/wicked', 'show-config']);
        return XmlToJson(stdout, ['body', 'slaves', 'ipv4:static', 'ipv6:static', 'ports']);
    }

    async getInterface(name) {
        const stdout = await cockpit.spawn(['/usr/sbin/wicked', 'show-xml', name]);
        const [data] = XmlToJson(stdout, ['body']);
        return data;
    }

    /**
     * Reloads a connection
     *
     * TODO: better error handling
     *
     * @return {Promise} Result of the operation
     */
    reloadConnection(name) {
        return cockpit.spawn(['/usr/sbin/wicked', 'ifreload', name], { superuser: "require" });
    }
}

export default WickedClient;
