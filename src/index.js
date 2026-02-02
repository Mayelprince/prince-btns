const { generateWAMessageFromContent, prepareWAMessageMedia, proto, getContentType, normalizeMessageContent } = require('@whiskeysockets/baileys');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getBizNode = (message, isGroup) => {
    const content = normalizeMessageContent(message);
    const contentType = getContentType(content);
    
    if (contentType === 'interactiveMessage' || contentType === 'buttonsMessage') {
        return {
            tag: 'biz',
            attrs: {},
            content: [{
                tag: 'interactive',
                attrs: {
                    type: 'native_flow',
                    v: '1'
                },
                content: [{
                    tag: 'native_flow',
                    attrs: { v: '9', name: 'mixed' }
                }]
            }]
        };
    } else if (contentType === 'listMessage') {
        return {
            tag: 'biz',
            attrs: {},
            content: [{
                tag: 'list',
                attrs: {
                    type: 'product_list',
                    v: '2'
                }
            }]
        };
    }
    return null;
};

const patchBaileysSocket = (sock) => {
    if (!sock) throw new Error('Socket instance is required');

    const originalRelayMessage = sock.relayMessage.bind(sock);
    const originalSendMessage = sock.sendMessage.bind(sock);

    sock.relayMessage = async (jid, message, opts = {}) => {
        const bizNode = getBizNode(message, jid.endsWith('@g.us'));
        
        if (bizNode) {
            const additionalNodes = opts.additionalNodes || [];
            additionalNodes.push(bizNode);
            
            if (!jid.endsWith('@g.us')) {
                additionalNodes.push({
                    tag: 'bot',
                    attrs: { biz_bot: '1' }
                });
            }
            
            opts.additionalNodes = additionalNodes;
        }
        
        return originalRelayMessage(jid, message, opts);
    };

    sock.sendMessage = async (jid, content, opts = {}) => {
        if (content.buttons && Array.isArray(content.buttons)) {
            let nativeButtons = [];
            let isSelectionList = false;

            // Check if we should use a selection list (original bot behavior)
            const hasSelection = content.buttons.some(b => b.type === 4 || b.nativeFlowInfo?.name === 'single_select');
            
            if (hasSelection) {
                isSelectionList = true;
                for (const btn of content.buttons) {
                    if (btn.nativeFlowInfo) {
                        nativeButtons.push({
                            name: btn.nativeFlowInfo.name,
                            buttonParamsJson: btn.nativeFlowInfo.paramsJson
                        });
                    } else if (btn.buttonId) {
                        // Fallback for list style if not explicitly nativeFlow
                        nativeButtons.push({
                            name: 'single_select',
                            buttonParamsJson: JSON.stringify({
                                title: btn.buttonText?.displayText || 'Select',
                                sections: [{
                                    title: 'Options',
                                    rows: [{
                                        title: btn.buttonText?.displayText || 'Option',
                                        id: btn.buttonId
                                    }]
                                }]
                            })
                        });
                    }
                }
            } else {
                // Default to quick_reply for simple buttons, but wrap in single_select if requested by user
                for (const btn of content.buttons) {
                    if (btn.nativeFlowInfo) {
                        nativeButtons.push({
                            name: btn.nativeFlowInfo.name,
                            buttonParamsJson: btn.nativeFlowInfo.paramsJson
                        });
                    } else if (btn.buttonId) {
                        nativeButtons.push({
                            name: 'quick_reply',
                            buttonParamsJson: JSON.stringify({
                                display_text: btn.buttonText?.displayText || 'Button',
                                id: btn.buttonId
                            })
                        });
                    }
                }
            }

            let header = { title: '', hasMediaAttachment: false };
            
            if (content.image) {
                const imageUrl = content.image.url || content.image;
                const image = await prepareWAMessageMedia({
                    image: { url: imageUrl }
                }, { upload: sock.waUploadToServer });
                header = {
                    title: content.header || '',
                    hasMediaAttachment: true,
                    imageMessage: image.imageMessage,
                };
            } else if (content.video) {
                const videoUrl = content.video.url || content.video;
                const video = await prepareWAMessageMedia({
                    video: { url: videoUrl }
                }, { upload: sock.waUploadToServer });
                header = {
                    title: content.header || '',
                    hasMediaAttachment: true,
                    videoMessage: video.videoMessage,
                };
            } else if (content.header) {
                header = { title: content.header, hasMediaAttachment: false };
            }

            const interactiveMessage = proto.Message.InteractiveMessage.create({
                body: proto.Message.InteractiveMessage.Body.create({ text: content.caption || content.text || '' }),
                footer: proto.Message.InteractiveMessage.Footer.create({ text: content.footer || '' }),
                header: proto.Message.InteractiveMessage.Header.create(header),
                nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                    buttons: nativeButtons,
                    messageParamsJson: ''
                })
            });

            const fullMsg = generateWAMessageFromContent(jid, {
                viewOnceMessage: {
                    message: {
                        interactiveMessage: interactiveMessage
                    }
                }
            }, { quoted: opts.quoted });

            await sock.sendPresenceUpdate('composing', jid);
            await sleep(300);
            
            return await sock.relayMessage(jid, fullMsg.message, { messageId: fullMsg.key.id });
        }
        
        return originalSendMessage(jid, content, opts);
    };

    sock.sendButtonMessage = async (jid, buttons, quoted, opts = {}) => {
        let header = { title: opts?.title || opts?.header || '', hasMediaAttachment: false };
        
        if (opts?.video) {
            const video = await prepareWAMessageMedia({
                video: { url: opts.video }
            }, { upload: sock.waUploadToServer });
            header = {
                title: opts?.title || opts?.header || '',
                hasMediaAttachment: true,
                videoMessage: video.videoMessage,
            };
        } else if (opts?.image) {
            const image = await prepareWAMessageMedia({
                image: { url: opts.image }
            }, { upload: sock.waUploadToServer });
            header = {
                title: opts?.title || opts?.header || '',
                hasMediaAttachment: true,
                imageMessage: image.imageMessage,
            };
        }

        const interactiveMessage = proto.Message.InteractiveMessage.create({
            body: proto.Message.InteractiveMessage.Body.create({ text: opts?.body || '' }),
            footer: proto.Message.InteractiveMessage.Footer.create({ text: opts?.footer || '' }),
            header: proto.Message.InteractiveMessage.Header.create(header),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                buttons: buttons,
                messageParamsJson: ''
            })
        });

        const fullMsg = generateWAMessageFromContent(jid, {
            viewOnceMessage: {
                message: {
                    interactiveMessage: interactiveMessage
                }
            }
        }, { quoted: quoted });

        await sock.sendPresenceUpdate('composing', jid);
        await sleep(300);
        
        return await sock.relayMessage(jid, fullMsg.message, { messageId: fullMsg.key.id });
    };

    sock.sendListMessage = async (jid, sections, quoted, opts = {}) => {
        const listSections = sections.map(section => ({
            title: section.title,
            rows: section.rows.map(row => ({
                header: row.header || '',
                title: row.title,
                description: row.description || '',
                id: row.id || row.title
            }))
        }));

        const listButton = {
            name: 'single_select',
            buttonParamsJson: JSON.stringify({
                title: opts?.buttonText || 'Select',
                sections: listSections
            })
        };

        let header = { title: opts?.title || opts?.header || '', hasMediaAttachment: false };
        
        if (opts?.video) {
            const video = await prepareWAMessageMedia({
                video: { url: opts.video }
            }, { upload: sock.waUploadToServer });
            header = {
                title: opts?.title || opts?.header || '',
                hasMediaAttachment: true,
                videoMessage: video.videoMessage,
            };
        } else if (opts?.image) {
            const image = await prepareWAMessageMedia({
                image: { url: opts.image }
            }, { upload: sock.waUploadToServer });
            header = {
                title: opts?.title || opts?.header || '',
                hasMediaAttachment: true,
                imageMessage: image.imageMessage,
            };
        }

        const interactiveMessage = proto.Message.InteractiveMessage.create({
            body: proto.Message.InteractiveMessage.Body.create({ text: opts?.body || '' }),
            footer: proto.Message.InteractiveMessage.Footer.create({ text: opts?.footer || '' }),
            header: proto.Message.InteractiveMessage.Header.create(header),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                buttons: [listButton],
                messageParamsJson: ''
            })
        });

        const fullMsg = generateWAMessageFromContent(jid, {
            viewOnceMessage: {
                message: {
                    interactiveMessage: interactiveMessage
                }
            }
        }, { quoted: quoted });

        await sock.sendPresenceUpdate('composing', jid);
        await sleep(300);
        
        return await sock.relayMessage(jid, fullMsg.message, { messageId: fullMsg.key.id });
    };

    console.log('[prince-buttons] Socket patched with button support');
    return sock;
};

const createButton = (type, text, data) => {
    switch (type) {
        case 'reply':
        case 'quick_reply':
            return {
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                    display_text: text,
                    id: data
                })
            };
        case 'url':
        case 'cta_url':
            return {
                name: 'cta_url',
                buttonParamsJson: JSON.stringify({
                    display_text: text,
                    url: data,
                    merchant_url: data
                })
            };
        case 'call':
        case 'cta_call':
            return {
                name: 'cta_call',
                buttonParamsJson: JSON.stringify({
                    display_text: text,
                    phone_number: data
                })
            };
        case 'copy':
        case 'cta_copy':
            return {
                name: 'cta_copy',
                buttonParamsJson: JSON.stringify({
                    display_text: text,
                    copy_code: data
                })
            };
        case 'location':
        case 'send_location':
            return {
                name: 'send_location',
                buttonParamsJson: JSON.stringify({
                    display_text: text
                })
            };
        default:
            return {
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                    display_text: text,
                    id: data || text
                })
            };
    }
};

const createSection = (title, rows) => ({
    title: title,
    rows: rows.map(row => ({
        header: row.header || '',
        title: row.title || row,
        description: row.description || '',
        id: row.id || row.title || row
    }))
});

const sendListFromData = async (sock, jid, listData, quoted, opts = {}) => {
    const sections = listData.sections.map(section => ({
        title: section.title,
        rows: section.rows.map(row => ({
            header: row.header || '',
            title: row.title,
            description: row.description || '',
            id: row.id || row.title
        }))
    }));

    return await sock.sendListMessage(jid, sections, quoted, {
        header: opts?.header || opts?.title || '',
        body: opts?.body || opts?.caption || '',
        footer: opts?.footer || '',
        buttonText: listData?.title || opts?.buttonText || 'Select'
    });
};

module.exports = {
    patchBaileysSocket,
    createButton,
    createSection,
    sendListFromData,
    getBizNode,
    sleep
};
