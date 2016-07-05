"use strict";

var SingularStatusEnum = {
	PENDING: 0,
	RESOLVED: 1,
	REJECTED: 2
};

function singularIsPending() {
	return this.$$status === SingularStatusEnum.PENDING;
}

function singularIsResolved() {
	return this.$$status === SingularStatusEnum.RESOLVED;
}

function singularIsRejected() {
	return this.$$status === SingularStatusEnum.REJECTED;
}

function initialValue() {
	return void 0;
}

exports.SingularStatusEnum = SingularStatusEnum;
exports.singularIsPending = singularIsPending;
exports.singularIsResolved = singularIsResolved;
exports.singularIsRejected = singularIsRejected;
exports.initialValue = initialValue;