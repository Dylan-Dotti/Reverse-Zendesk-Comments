
(async function() {

    const BROWSER_API = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : undefined);
    const LS_REVERSED_KEY = "RZC_REVERSED_STATE";
    const TICKET_CACHE = [];

    const addRule = (function (style) {
        var sheet = document.head.appendChild(style).sheet;
        return function (selector, css) {
            var propText = typeof css === "string" ? css : Object.keys(css).map(function (p) {
                return p + ":" + (p === "content" ? "'" + css[p] + "'" : css[p]);
            }).join(";");
            sheet.insertRule(selector + "{" + propText + "}", sheet.cssRules.length);
        };
    })(document.createElement("style"));


    function getReversedState() {
        return new Promise((resolve, reject) => {
            BROWSER_API.storage.local.get(LS_REVERSED_KEY, (data) => {
                if (BROWSER_API.runtime.lastError) {
                    reject(BROWSER_API.runtime.lastError);
                } 
                else {
                    resolve(data[LS_REVERSED_KEY]);
                }
            });
        });
    }

    function setReversedState(reversed) {
        return new Promise((resolve, reject) => {
            BROWSER_API.storage.local.set({ [LS_REVERSED_KEY]: reversed }, () => {
                if (BROWSER_API.runtime.lastError) {
                    reject(BROWSER_API.runtime.lastError);
                } 
                else {
                    resolve();
                }
            });
        });
    }

    function onReversedStateChanged(change, commentsParent, dropdownParent) {
        const newState = change.newValue;
        const dropdownToggle = dropdownParent.querySelector(".dropdown-toggle");
        dropdownToggle.innerHTML = `${newState ? "Reverse Order" : "Default Order"} `;

        if (newState) {
            onReversedState(commentsParent, dropdownParent);
        }
        else {
            onDefaultState(commentsParent, dropdownParent);
        }
    }

    function onDefaultState(commentsParent, dropdownParent) {
        console.log("Default state");

        const commentNodes = getCommentNodes(commentsParent);
        const commentsSorted = sortCommentsById(commentNodes).reverse();
        refreshCommentNodes(commentsParent, commentsSorted);

        const dropdownItems = getDropdownMenuItems(dropdownParent);
        dropdownItems[0].classList.add("selected");
        dropdownItems[1].classList.remove("selected");
    }

    function onReversedState(commentsParent, dropdownParent) {
        console.log("Reversed state");

        const commentNodes = getCommentNodes(commentsParent);
        const commentsSorted = sortCommentsById(commentNodes);
        refreshCommentNodes(commentsParent, commentsSorted);

        const dropdownItems = getDropdownMenuItems(dropdownParent);
        dropdownItems[0].classList.remove("selected");
        dropdownItems[1].classList.add("selected");
    }

    function getCommentNodes(commentParentNode) {
        return Array.from(commentParentNode.childNodes)
    }

    function refreshCommentNodes(commentParentNode, newCommentNodes) {
        removeCommentNodes(commentParentNode);
        addCommentNodes(commentParentNode, newCommentNodes);
    }

    function removeCommentNodes(commentParentNode) {
        while (commentParentNode.firstChild) {
            commentParentNode.removeChild(commentParentNode.firstChild);
        }
    }

    function addCommentNodes(commentParentNode, commentNodes) {
        for (const node of commentNodes) {
            commentParentNode.appendChild(node);
        }
    }
    
    function getCommentId(commentNode) {
        return Number(commentNode.getAttribute("data-audit-id"));
    }

    function sortCommentsById(commentNodes) {
        const nodeArray = Array.from(commentNodes);

        nodeArray.sort((a, b) => {
            const aId = getCommentId(a);
            const bId = getCommentId(b);
            return aId > bId ? 1 : (aId < bId ? -1 : 0);
        });

        return nodeArray;
    }

    function getDropdownMenuItems(dropdownParent) {
        return Array.from(dropdownParent.querySelectorAll(".dropdown-menu li"));
    }
    
    async function generateDropdown(dropdownParent) {

        const reversedState = await getReversedState();
    
        const dropdown = dropdownParent.querySelector(".conversation-nav");
        const dropdownClone = dropdown.cloneNode(true);
        const dropdownCloneToggle = dropdownClone.querySelector(".dropdown-toggle");

        // Set up dropdown
        dropdownClone.classList.add("direction-dropdown");
        dropdownCloneToggle.innerHTML = `${reversedState ? "Reverse Order" : "Default Order"} `;

        // Set up menu items
        const dropdownCloneMenuItems = getDropdownMenuItems(dropdownClone);
        dropdownCloneMenuItems.forEach(node => { 
            node.classList.remove("ember-view");
            node.classList.remove("selected");
        });

        const defaultMenuItem = dropdownCloneMenuItems[0];
        defaultMenuItem.addEventListener("click", () => { setReversedState(false) });
        defaultMenuItem.querySelector("a").innerHTML = "Default Order";
        if (!reversedState) {
            defaultMenuItem.classList.add("selected");
        }
        
        const reversedMenuItem = dropdownCloneMenuItems[1];
        reversedMenuItem.addEventListener("click", () => { setReversedState(true) });
        reversedMenuItem.querySelector("a").innerHTML = "Reverse Order";
        if (reversedState) {
            reversedMenuItem.classList.add("selected");
        }
    
        dropdownParent.insertBefore(dropdownClone, dropdown);
    }

    async function onPageLoaded() {

        // Wait for SPA to finish loading DOM elements
        window.requestIdleCallback(async () => {

            addRule(".section.ticket .direction-dropdown:after", {
                "border-right": "0px"
            });

            const tickets = Array.from(
                document.querySelectorAll("#wrapper #main_panes .ember-view.workspace:not(.is-cached) section.ticket")
            ).filter(t => !TICKET_CACHE.includes(t));

            tickets.forEach(t => TICKET_CACHE.push(t));

            for (let ticket of tickets) {

                const commentsParent = ticket.querySelector(".audits");
                const dropdownParent = ticket.querySelector(".tab-controls-container");
        
                await generateDropdown(dropdownParent);
        
                if (await getReversedState()) {
                    onReversedState(commentsParent, dropdownParent);
                }
        
                BROWSER_API.storage.onChanged.addListener((changes, namespace) => {
                    for (let key in changes) {
                        if (key === LS_REVERSED_KEY) {
                            onReversedStateChanged(changes[key], commentsParent, dropdownParent);
                        }
                    }
                });
        
                let lastChildCount = commentsParent.childNodes.length;
            
                const observer = new MutationObserver(async (mutationsList) => {
            
                    // Loop through the list of mutations
                    for (const mutation of mutationsList) {
                        if (mutation.type === 'childList' && commentsParent.childNodes.length !== lastChildCount) {
            
                            // Handle the childList mutation
                            lastChildCount = commentsParent.childNodes.length;
        
                            if (await getReversedState()) {
                                onReversedState(commentsParent, dropdownParent);
                            }
                            else {
                                onDefaultState(commentsParent, dropdownParent);
                            }
                        }
                    }
            
                });
                
                const config = { childList: true };
                
                observer.observe(commentsParent, config);
            }
        });
    }
    

    // Start of execution

    onPageLoaded();

    // Listen for url changes from the background script
    BROWSER_API.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.message === 'urlChanged') {
          console.log('URL changed to:', message.url);
          onPageLoaded();
        }
    });

})();